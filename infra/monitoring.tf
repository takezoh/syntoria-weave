resource "google_monitoring_notification_channel" "email" {

  for_each     = toset(var.alert_emails)
  display_name = "${var.name} operations"
  type         = "email"
  labels = {
    email_address = each.value
  }


}

resource "google_logging_metric" "requests" {

  for_each = {
    requests = "", errors = " AND jsonPayload.status>=500"
  }

  name   = "${var.name}_${each.key}"
  filter = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.name}\" AND jsonPayload.duration_ms:*${each.value}"
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }


}

resource "google_monitoring_alert_policy" "errors" {

  display_name          = "${var.name} error ratio"
  combiner              = "AND"
  notification_channels = [for c in google_monitoring_notification_channel.email : c.name]
  conditions {

    display_name = "Error rate over one percent"
    condition_threshold {

      filter             = "resource.type=\"cloud_run_revision\" AND metric.type=\"logging.googleapis.com/user/${google_logging_metric.requests["errors"].name}\""
      denominator_filter = "resource.type=\"cloud_run_revision\" AND metric.type=\"logging.googleapis.com/user/${google_logging_metric.requests["requests"].name}\""
      comparison         = "COMPARISON_GT"
      threshold_value    = 0.01
      duration           = "300s"
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }

      denominator_aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }


    }


  }

  conditions {

    display_name = "At least twenty requests"
    condition_threshold {

      filter          = "resource.type=\"cloud_run_revision\" AND metric.type=\"logging.googleapis.com/user/${google_logging_metric.requests["requests"].name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 19
      duration        = "0s"
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }


    }


  }


}

resource "google_logging_metric" "pool_wait" {

  name            = "${var.name}_pool_wait_ms"
  filter          = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.name}\" AND jsonPayload.pool_wait_ms:*"
  value_extractor = "EXTRACT(jsonPayload.pool_wait_ms)"
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "DISTRIBUTION"
  }

  bucket_options {
    explicit_buckets {
      bounds = [0, 10, 50, 100, 500, 1000, 3000]
    }

  }


}

resource "google_monitoring_alert_policy" "pool" {

  display_name          = "${var.name} pool pressure"
  combiner              = "OR"
  notification_channels = [for c in google_monitoring_notification_channel.email : c.name]
  conditions {

    display_name = "Sustained pool wait"
    condition_threshold {

      filter          = "resource.type=\"cloud_run_revision\" AND metric.type=\"logging.googleapis.com/user/${google_logging_metric.pool_wait.name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 500
      duration        = "300s"
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_PERCENTILE_95"
        cross_series_reducer = "REDUCE_MAX"
      }


    }


  }


}

resource "google_logging_metric" "backup_success" {

  name   = "${var.name}_backup_success"
  filter = "resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"${var.name}-backup\" AND jsonPayload.operation=\"backup\" AND jsonPayload.status=\"ok\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }


}

resource "google_monitoring_alert_policy" "backup_age" {

  display_name          = "${var.name} missing backup"
  combiner              = "OR"
  notification_channels = [for c in google_monitoring_notification_channel.email : c.name]
  conditions {

    display_name = "No successful backup for 26 hours"
    condition_absent {

      filter   = "resource.type=\"cloud_run_job\" AND metric.type=\"logging.googleapis.com/user/${google_logging_metric.backup_success.name}\""
      duration = "93600s"
      aggregations {
        alignment_period     = "3600s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }


    }


  }


}

data "google_project" "current" {

}

resource "google_billing_budget" "environment" {

  billing_account = var.billing_account
  display_name    = "${var.name} monthly alert"
  budget_filter {
    projects = ["projects/${data.google_project.current.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(floor(var.monthly_budget_usd))
    }

  }

  threshold_rules {
    threshold_percent = 0.5
  }

  threshold_rules {
    threshold_percent = 0.9
  }

  threshold_rules {
    threshold_percent = 1.0
  }


}
