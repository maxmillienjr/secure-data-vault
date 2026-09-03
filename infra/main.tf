terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state, declared as a PARTIAL configuration: the bucket is supplied at
  # init time rather than hardcoded, since a public reference repository has no
  # real bucket name to commit.
  #
  #   terraform init \
  #     -backend-config="bucket=<your-tf-state-bucket>" \
  #     -backend-config="prefix=secure-data-vault"
  #
  # State is sensitive here specifically: google_sql_user.password holds plaintext
  # in state regardless of Secret Manager (see ADR-008), so the state bucket needs
  # IAM at least as tight as the secret itself. Local state would put that
  # plaintext on a laptop.
  #
  # CI validates with `-backend=false` and never initializes this backend.
  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region
}
