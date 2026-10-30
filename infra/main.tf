locals {

  secret_ids = toset(["runtime-database", "admin-database", "backup-database", "gate-client-secret", "login-key", "csrf-key", "webhook-key-ring"])
  runtime_secrets = {
    DATABASE_URL                = "runtime-database"
    GATE_RESOURCE_CLIENT_SECRET = "gate-client-secret"
    WEBHOOK_KEY_RING            = "webhook-key-ring"
  }

  runtime_env = {
    PUBLIC_ORIGIN           = var.public_origin
    OAUTH_ISSUER            = var.oauth_issuer
    OAUTH_RESOURCE          = "${var.public_origin}/mcp"
    SHARED_COOKIE_DOMAIN    = var.shared_cookie_domain
    SPA_ORIGINS             = jsonencode(var.spa_origins)
    GATE_BROWSER_CLIENT_ID  = var.gate_browser_client_id
    GATE_RESOURCE_CLIENT_ID = var.gate_resource_client_id
    CURSOR_EPOCH            = var.cursor_epoch
    WRITE_MODE              = var.writes_enabled ? "enabled" : "blocked"
    NODE_ENV                = "production"
    WEBHOOK_TASK_QUEUE           = google_cloud_tasks_queue.webhooks.id
    WEBHOOK_TASK_SERVICE_ACCOUNT = google_service_account.identity["tasks"].email
  }


}

resource "google_project_service" "api" {

  for_each           = toset(["run.googleapis.com", "artifactregistry.googleapis.com", "secretmanager.googleapis.com", "iam.googleapis.com", "iamcredentials.googleapis.com", "sts.googleapis.com", "cloudscheduler.googleapis.com", "monitoring.googleapis.com", "logging.googleapis.com", "billingbudgets.googleapis.com", "cloudtasks.googleapis.com"])
  service            = each.value
  disable_on_destroy = false

}

resource "google_artifact_registry_repository" "images" {

  location      = var.region
  repository_id = var.name
  format        = "DOCKER"
  depends_on    = [google_project_service.api]

}

resource "google_service_account" "identity" {

  for_each   = toset(["runtime", "deployer", "migrator", "backup", "scheduler", "tasks"])
  account_id = "${var.name}-${each.key}"

}

resource "google_secret_manager_secret" "secret" {

  for_each  = local.secret_ids
  secret_id = "${var.name}-${each.key}"
  replication {
    auto {

    }

  }

  depends_on = [google_project_service.api]

}

resource "google_secret_manager_secret_iam_member" "runtime" {

  for_each  = toset(values(local.runtime_secrets))
  secret_id = google_secret_manager_secret.secret[each.key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.identity["runtime"].email}"

}

resource "google_secret_manager_secret_iam_member" "job" {

  for_each = {
    migrator = "admin-database"
    backup   = "backup-database"
  }

  secret_id = google_secret_manager_secret.secret[each.value].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.identity[each.key].email}"

}

resource "google_cloud_run_v2_service" "api" {

  name                = "${var.name}-api"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = true
  template {

    service_account                  = google_service_account.identity["runtime"].email
    execution_environment            = "EXECUTION_ENVIRONMENT_GEN2"
    timeout                          = "30s"
    max_instance_request_concurrency = 20
    scaling {
      min_instance_count = 1
      max_instance_count = 3
    }

    containers {

      image = var.image
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }

        cpu_idle = true
      }

      ports {
        container_port = 8080
      }

      startup_probe {
        http_get {
          path = "/health/ready"
        }

        period_seconds    = 5
        failure_threshold = 24
      }

      liveness_probe {
        http_get {
          path = "/health/live"
        }

      }

      dynamic "env" {

        for_each = local.runtime_env
        content {
          name  = env.key
          value = env.value
        }


      }

      dynamic "env" {

        for_each = local.runtime_secrets
        content {

          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.secret[env.value].secret_id
              version = var.secret_versions[env.value]
            }

          }


        }


      }


    }


  }

  lifecycle {

    precondition {

      condition     = !var.writes_enabled || var.public_origin != "https://bootstrap.invalid"
      error_message = "Resolve the actual canonical origin before enabling writes."

    }


  }

  depends_on = [google_project_service.api, google_secret_manager_secret_iam_member.runtime]

}

resource "google_cloud_run_v2_service_iam_member" "https" {

  name     = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"

}

resource "google_storage_bucket" "backup" {

  name                        = "${var.name}-backups-${var.project_id}"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  lifecycle_rule {
    condition {
      age = 30
    }

    action {
      type = "Delete"
    }

  }


}

resource "google_storage_bucket_iam_member" "backup_writer" {

  bucket = google_storage_bucket.backup.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.identity["backup"].email}"

}

resource "google_cloud_run_v2_job" "job" {

  for_each = {
    migrator = "migrate"
    backup   = "backup"
  }

  name                = "${var.name}-${each.key}"
  location            = var.region
  deletion_protection = true
  template {

    template {

      service_account = google_service_account.identity[each.key].email
      max_retries     = each.key == "migrator" ? 0 : 1
      timeout         = "900s"
      containers {

        image   = var.image
        command = ["node"]
        args    = each.key == "migrator" ? ["dist/server/admin.mjs", "migrate"] : ["dist/server/backup.mjs"]
        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }

        }

        env {

          name = each.key == "migrator" ? "ADMIN_DATABASE_URL" : "BACKUP_DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.secret[each.key == "migrator" ? "admin-database" : "backup-database"].secret_id
              version = var.secret_versions[each.key == "migrator" ? "admin-database" : "backup-database"]
            }

          }


        }

        env {
          name  = "BACKUP_BUCKET"
          value = google_storage_bucket.backup.name
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }


      }


    }


  }

  depends_on = [google_secret_manager_secret_iam_member.job]

}

resource "google_cloud_run_v2_job_iam_member" "scheduler" {

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.job["backup"].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.identity["scheduler"].email}"

}

resource "google_cloud_scheduler_job" "backup" {

  name             = "${var.name}-nightly-backup"
  region           = var.region
  schedule         = "0 18 * * *"
  time_zone        = "Etc/UTC"
  attempt_deadline = "60s"
  http_target {

    uri         = "https://run.googleapis.com/v2/projects/${var.project_id}/locations/${var.region}/jobs/${google_cloud_run_v2_job.job["backup"].name}:run"
    http_method = "POST"
    headers = {
      "Content-Type" = "application/json"
    }

    body = base64encode("{}")
    oauth_token {
      service_account_email = google_service_account.identity["scheduler"].email
    }


  }


}

# Event delivery wakes the service only through these tasks; nothing runs while the queue is empty.
resource "google_cloud_tasks_queue" "webhooks" {

  name     = "${var.name}-webhooks"
  location = var.region
  retry_config {
    max_attempts       = 100
    max_retry_duration = "86400s"
    min_backoff        = "10s"
    max_backoff        = "600s"
    max_doublings      = 6
  }

  depends_on = [google_project_service.api]

}

resource "google_cloud_tasks_queue_iam_member" "runtime_enqueue" {

  name     = google_cloud_tasks_queue.webhooks.name
  location = google_cloud_tasks_queue.webhooks.location
  role     = "roles/cloudtasks.enqueuer"
  member   = "serviceAccount:${google_service_account.identity["runtime"].email}"

}

# The runtime names the task identity in each task's OIDC token; the service verifies that identity on internal routes.
resource "google_service_account_iam_member" "runtime_task_identity" {

  service_account_id = google_service_account.identity["tasks"].name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.identity["runtime"].email}"

}
