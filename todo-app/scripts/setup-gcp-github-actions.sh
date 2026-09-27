#!/usr/bin/env bash
set -euo pipefail

# One-time GCP setup for GitHub Actions deploys (Workload Identity Federation).
#
# Usage:
#   PROJECT_ID=<gcp-project-id> GITHUB_REPO=<owner/repo> ./setup-gcp-github-actions.sh
#
# Defaults match the course example project; override via env vars if yours differ.
# Creates (idempotently where possible):
#   - service account + Artifact Registry / GKE roles
#   - Workload Identity Pool + OIDC provider (locked to the repo)
#   - IAM binding letting the repo impersonate the service account

PROJECT_ID="${PROJECT_ID:-dwk-gke-509503}"
GITHUB_REPO="${GITHUB_REPO:-JuanitoSebastian/DevOps-With-Kubernetes}"
SA_NAME="${SA_NAME:-github-actions-sa}"
POOL_NAME="${POOL_NAME:-github-pool}"
PROVIDER_NAME="${PROVIDER_NAME:-github-provider}"
SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

echo "==> Using PROJECT_ID=$PROJECT_ID GITHUB_REPO=$GITHUB_REPO"

echo "==> Creating service account $SA_NAME (if not exists)"
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" --display-name="GitHub Actions SA" --project="$PROJECT_ID"
fi

echo "==> Granting Artifact Registry + GKE roles"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --role="roles/artifactregistry.writer" \
  --member="serviceAccount:$SA_EMAIL"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --role="roles/container.developer" \
  --member="serviceAccount:$SA_EMAIL"

echo "==> Creating Workload Identity Pool $POOL_NAME (if not exists)"
if ! gcloud iam workload-identity-pools describe "$POOL_NAME" --location="global" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL_NAME" --location="global" \
    --display-name="GitHub Actions Pool" --project="$PROJECT_ID"
fi

echo "==> Creating OIDC provider $PROVIDER_NAME (if not exists)"
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_NAME" --location="global" \
  --workload-identity-pool="$POOL_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_NAME" --location="global" \
    --workload-identity-pool="$POOL_NAME" --project="$PROJECT_ID" --display-name="GitHub provider" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository=='$GITHUB_REPO'" \
    --issuer-uri="https://token.actions.githubusercontent.com"
fi

echo "==> Letting the repo impersonate the service account"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$PROJECT_ID" --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_NAME/attribute.repository/$GITHUB_REPO"

echo "==> Done. Configure these GitHub secrets:"
echo "GKE_PROJECT=$PROJECT_ID"
echo "SERVICE_ACCOUNT=$SA_EMAIL"
echo "WORKLOAD_IDENTITY_PROVIDER=projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_NAME/providers/$PROVIDER_NAME"
