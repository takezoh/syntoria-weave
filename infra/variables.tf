variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "asia-southeast1"
}

variable "name" {

  type    = string
  default = "weave"
  validation {

    condition     = can(regex("^[a-z][a-z0-9-]{1,25}$", var.name))
    error_message = "Use a short product resource prefix."

  }


}

variable "image" {

  type = string
  validation {

    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.image))
    error_message = "Deploy an immutable image digest."

  }


}

variable "public_origin" {

  type    = string
  default = "https://bootstrap.invalid"
  validation {

    condition     = can(regex("^https://[a-zA-Z0-9.-]+$", var.public_origin))
    error_message = "Use an HTTPS origin without a path."

  }


}

variable "oauth_issuer" {
  type = string
}

variable "shared_cookie_domain" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$", var.shared_cookie_domain))
    error_message = "Use a normalized multi-label DNS parent without a port, path, wildcard or trailing dot."
  }
}

variable "spa_origins" {
  type = list(string)
  validation {
    condition     = length(var.spa_origins) > 0 && length(distinct(var.spa_origins)) == length(var.spa_origins) && alltrue([for origin in var.spa_origins : can(regex("^https://[A-Za-z0-9.-]+$", origin))])
    error_message = "Use a nonempty list of unique HTTPS SPA origins."
  }
}

variable "gate_browser_client_id" {
  type = string
}

variable "cursor_epoch" {
  type = string
}

variable "writes_enabled" {
  type    = bool
  default = false
}

variable "github_repository" {
  type = string
}

variable "github_environment" {
  type    = string
  default = "production"
}

variable "github_ref" {
  type    = string
  default = "refs/heads/main"
}

variable "secret_versions" {

  description = "Pinned existing Secret Manager versions; never secret values."
  type        = map(string)
  validation {

    condition     = alltrue([for v in values(var.secret_versions) : can(regex("^[0-9]+$", v))])
    error_message = "Pin numerical versions, not latest."

  }


}

variable "alert_emails" {
  type = list(string)
}

variable "billing_account" {
  type = string
}

variable "monthly_budget_usd" {
  type = number
}

variable "gate_resource_client_id" {
  type = string
}
