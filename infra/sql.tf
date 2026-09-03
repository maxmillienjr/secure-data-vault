# Cloud SQL for Postgres 16 instance.
# No unsupported extensions — gen_random_uuid() is built-in since Postgres 13.

resource "google_sql_database_instance" "vault" {
  name             = "vault-db"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier = var.db_tier

    ip_configuration {
      ipv4_enabled    = false
      private_network = "projects/${var.project_id}/global/networks/default"
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
    }

    database_flags {
      name  = "log_statement"
      value = "ddl"
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "vault" {
  name     = var.db_name
  instance = google_sql_database_instance.vault.name
}

# Application database credential.
#
# The password is generated at apply time and stored in Secret Manager. It is
# never written into the configuration, so the credential is not in version
# control and can be rotated without a code change. The vault-api service
# account is granted accessor on THIS SECRET ONLY (see iam.tf), matching the
# per-key binding pattern used for the KMS keys.
#
# Honest boundary on what this does and does not buy: google_sql_user.password
# lands in Terraform state in plaintext no matter where the value originates.
# Secret Manager removes the credential from the repository and gives the
# running service a rotatable read path. It does not make state non-sensitive.
# The remote backend declared in main.tf is what protects state, and that
# bucket needs IAM at least as tight as this secret's.

resource "random_password" "vault_app" {
  length  = 32
  special = true

  # Restricted to characters that require no percent-encoding in the userinfo
  # component of a postgres:// URL, since the password is interpolated into
  # DATABASE_URL at deploy time.
  override_special = "!*()-_+.~"
}

resource "google_secret_manager_secret" "vault_db_password" {
  secret_id = "vault-db-password"

  labels = {
    service    = "vault-api"
    credential = "cloud-sql"
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "vault_db_password" {
  secret      = google_secret_manager_secret.vault_db_password.id
  secret_data = random_password.vault_app.result
}

resource "google_sql_user" "vault_app" {
  name     = "vault-app"
  instance = google_sql_database_instance.vault.name
  password = random_password.vault_app.result
}
