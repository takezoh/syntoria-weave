resource "google_iam_workload_identity_pool" "github" {

  workload_identity_pool_id = "${var.name}-github"
  depends_on                = [google_project_service.api]

}

resource "google_iam_workload_identity_pool_provider" "github" {

  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == '${var.github_repository}' && assertion.ref == '${var.github_ref}' && assertion.sub == 'repo:${var.github_repository}:environment:${var.github_environment}'"
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }


}

resource "google_service_account_iam_member" "wif" {

  service_account_id = google_service_account.identity["deployer"].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"

}

resource "google_artifact_registry_repository_iam_member" "push" {

  location   = var.region
  repository = google_artifact_registry_repository.images.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.identity["deployer"].email}"

}

resource "google_cloud_run_v2_service_iam_member" "deploy" {

  name     = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.identity["deployer"].email}"

}

resource "google_cloud_run_v2_job_iam_member" "deploy" {

  for_each = google_cloud_run_v2_job.job
  name     = each.value.name
  location = var.region
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.identity["deployer"].email}"

}

resource "google_service_account_iam_member" "act_as" {

  for_each           = toset(["runtime", "migrator", "backup"])
  service_account_id = google_service_account.identity[each.key].name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.identity["deployer"].email}"

}

output "service_url" {
  value = google_cloud_run_v2_service.api.uri
}

output "workload_identity_provider" {
  value = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_service_account" {
  value = google_service_account.identity["deployer"].email
}

output "backup_bucket" {
  value = google_storage_bucket.backup.name
}
