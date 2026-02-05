Ì≥ú List of Commands Executed in the Project (With Purpose)

This project follows a production DevOps lifecycle:
Infra ‚Üí CI ‚Üí GitOps ‚Üí Runtime ‚Üí Monitoring

Ì¥π PHASE 1 ‚Äî Azure & Terraform (Infrastructure)
1Ô∏è‚É£ Azure Authentication
az login


Why:
Authenticates the local machine with Azure so Terraform and CLI can manage Azure resources.

az account set --subscription <SUBSCRIPTION_ID>


Why:
Ensures all resources are created in the correct Azure subscription (critical in enterprise environments).

2Ô∏è‚É£ Terraform Initialization
terraform init


Why:

Downloads required providers

Configures remote backend

Initializes Terraform modules

terraform init -reconfigure


Why:
Used when:

Backend changes (local ‚Üí Azure Storage)

Modules are updated

Forces Terraform to reload configuration safely

3Ô∏è‚É£ Terraform Validation & Planning
terraform validate


Why:
Checks Terraform syntax and configuration correctness before execution.

terraform plan


Why:

Shows what Terraform will create/modify

Prevents accidental infrastructure changes

Mandatory review step in production

4Ô∏è‚É£ Terraform Apply
terraform apply


Why:
Creates all Azure resources:

VNet

Subnets

AKS cluster

ACR

Role assignments

Ì¥π PHASE 2 ‚Äî AKS Access & Validation
5Ô∏è‚É£ Get AKS Credentials
az aks get-credentials \
  --resource-group LabsKraft360 \
  --name aks-recruitment-prod


Why:

Downloads kubeconfig

Allows kubectl to communicate with AKS

Required once per user/machine

6Ô∏è‚É£ Verify AKS Nodes
kubectl get nodes


Why:
Confirms:

AKS cluster is running

Node pools are ready

Kubernetes control plane is accessible

kubectl get pods -A


Why:
Checks system pods (kube-system) to ensure:

Core components are healthy

No cluster-level issues

Ì¥π PHASE 3 ‚Äî Azure Container Registry (ACR)
7Ô∏è‚É£ Verify ACR
az acr list -g LabsKraft360 -o table


Why:
Confirms that Azure Container Registry was created successfully.

az acr repository list \
  --name acrrecruitmentprod \
  -o table


Why:
Lists repositories (Docker images) stored in ACR.

Ì¥π PHASE 4 ‚Äî CI Pipeline (GitHub Actions)
8Ô∏è‚É£ Git Commands (Trigger CI)
git add .
git commit -m "Add Dockerfile and CI pipeline"
git push origin main


Why:

Triggers GitHub Actions CI pipeline

Starts Docker image build & push

git tag v1.0.1
git push origin v1.0.1


Why:

Creates versioned Docker image

Enables traceability and rollback

Production best practice

Ì¥π PHASE 5 ‚Äî Kubernetes Runtime (Validation Only)

‚ö†Ô∏è Used only for validation, NOT production deployment

9Ô∏è‚É£ Namespace & Resources Check
kubectl get ns


Why:
Ensures required namespaces exist (recruitment, argocd, monitoring).

kubectl get all -n recruitment


Why:
Verifies:

Pods

Services

Deployments

StatefulSets

Ì¥π PHASE 6 ‚Äî Persistent Volume (MySQL)
Ì¥ü Storage Verification
kubectl get sc


Why:
Confirms StorageClass (azure-disk-sc) exists.

kubectl get pvc -n recruitment


Why:
Checks if PersistentVolumeClaims are:

Created

Bound to Azure Disks

kubectl describe pvc mysql-data-mysql-0 -n recruitment


Why:
Validates:

Disk provisioning

Storage class

Capacity

Binding status

1Ô∏è‚É£1Ô∏è‚É£ Persistence Test
kubectl delete pod mysql-0 -n recruitment


Why:
Tests real persistence:

Pod restarts

Data remains intact

Confirms production-ready storage

Ì¥π PHASE 7 ‚Äî Argo CD (GitOps)
1Ô∏è‚É£2Ô∏è‚É£ Argo CD Installation
kubectl create namespace argocd


Why:
Creates isolated namespace for GitOps controller.

kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml


Why:
Installs Argo CD components:

API server

Controller

Repo server

1Ô∏è‚É£3Ô∏è‚É£ Access Argo CD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443


Why:
Temporary local access to Argo CD UI (lab/demo purpose).

kubectl get secret argocd-initial-admin-secret \
  -n argocd \
  -o jsonpath="{.data.password}" | base64 -d


Why:
Retrieves initial admin password for Argo CD login.

1Ô∏è‚É£4Ô∏è‚É£ Apply Argo CD Application
kubectl apply -f argocd/recruitment-app.yaml


Why:
Registers Helm chart with Argo CD so:

Git becomes source of truth

Auto-sync is enabled

Ì¥π PHASE 8 ‚Äî GitOps Deployment Flow
1Ô∏è‚É£5Ô∏è‚É£ GitOps Update (Deployment)
git commit -am "Update image tag"
git push


Why:

Triggers Argo CD auto-sync

Deploys new version without kubectl

Ensures auditability

git revert <commit-id>
git push


Why:
Performs rollback via Git ‚Äî safest rollback mechanism.

Ì¥π PHASE 9 ‚Äî Monitoring (Prometheus & Grafana)
1Ô∏è‚É£6Ô∏è‚É£ Monitoring Validation
kubectl get pods -n monitoring


Why:
Confirms Prometheus, Grafana, Alertmanager are running.

kubectl get svc -n monitoring


Why:
Retrieves Grafana LoadBalancer IP for dashboard access.

Ì∑† INTERVIEW-READY SUMMARY (IMPORTANT)

You can confidently say:

‚ÄúI used Azure CLI for authentication, Terraform for infrastructure provisioning, GitHub Actions for CI, Helm and Argo CD for GitOps-based CD, Kubernetes CSI for persistent storage, and Prometheus/Grafana for observability.‚Äù

‚úÖ FINAL COMMAND COUNT (OVERVIEW)
Phase	Approx Commands
Azure + Terraform	~10
AKS Validation	~5
CI/CD	~6
GitOps	~6
Storage	~5
Monitoring	~3


Authonr: kamlesh Wamankar
