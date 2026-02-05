📘 CAPSTONE PROJECT DOCUMENTATION
Recruitment Application on Azure AKS using Terraform, CI/CD, Helm & GitOps

1️⃣ Project Overview
Project Name
Recruitment Application – Production Deployment on Azure AKS

Objective

To design and implement a production-ready Kubernetes platform on Azure using modern DevOps & GitOps practices.

The platform must:

Be highly available

Be scalable

Support CI/CD

Use Infrastructure as Code

Follow GitOps (no manual kubectl in prod)

Persist database data

Provide monitoring & observability

2️⃣ High-Level Architecture
Developer
   ↓
GitHub (Application Repo)
   ↓
GitHub Actions (CI)
   ↓
Azure Container Registry (ACR)
   ↓
GitHub (GitOps Repo)
   ↓
Argo CD
   ↓
Azure AKS
      ├─ API Service
      ├─ UI Service
      ├─ MySQL (Persistent)
      └─ Monitoring (Prometheus + Grafana)


3️⃣ Tools & Technologies Used
Category	Tools
Cloud	Azure
IaC	Terraform
Container	Docker
Orchestration	Kubernetes (AKS)
CI	GitHub Actions
CD	Argo CD (GitOps)
Packaging	Helm
Storage	Azure Disk (CSI)
Monitoring	Prometheus, Grafana
4️⃣ Repositories Used
4.1 Infrastructure Repository
recruitment-infra/


Purpose:

Provision Azure resources (VNet, AKS, ACR, IAM)

4.2 Application Repository
recruitment-app/


Purpose:

Application source code

Dockerfiles

CI pipelines

4.3 GitOps Repository
recruitment-gitops/


Purpose:

Helm charts

Kubernetes manifests

Argo CD Applications

🔹 STEP 1 — Terraform Setup (Foundation)
Purpose

Prepare Terraform

Configure remote backend

Authenticate with Azure

Command: Azure Login
az login
az account set --subscription <SUBSCRIPTION_ID>


Authenticates Terraform with Azure
Avoids hardcoded credentials

Terraform Backend (backend.tf)
terraform {
  backend "azurerm" {
    resource_group_name  = "LabsKraft360"
    storage_account_name = "tfstatelabskraft"
    container_name       = "tfstate"
    key                  = "recruitment-aks.tfstate"
  }
}


Stores Terraform state remotely
Enables collaboration & locking

Initialize Terraform
terraform init
terraform validate
terraform plan

🔹 STEP 2 — Network (VNet & Subnet)
Purpose

Isolate AKS networking

Enable Azure CNI (pod IPs from VNet)

Terraform Network Module Creates:

Virtual Network: 10.10.0.0/16

AKS Subnet: 10.10.1.0/24

Apply Network
terraform apply

Verify
az network vnet list -g LabsKraft360 -o table

🔹 STEP 3 — AKS Cluster (Production-Ready)
Purpose

Deploy managed Kubernetes

Enable autoscaling, RBAC, CSI storage

Key AKS Features

Azure CNI

System + User node pools

Autoscaling enabled

CSI storage drivers

RBAC enabled

Apply AKS
terraform apply

Get Credentials
az aks get-credentials \
  --resource-group LabsKraft360 \
  --name aks-recruitment-prod

Verify
kubectl get nodes
kubectl get pods -A

🔹 STEP 4 — Azure Container Registry (ACR)
Purpose

Store Docker images

Secure image pull by AKS

What Terraform Does

Creates ACR

Disables admin access

Grants AKS AcrPull via RBAC

Verify ACR
az acr list -g LabsKraft360 -o table

🔹 STEP 5 — CI Pipeline (GitHub Actions)
Purpose

Build Docker images

Tag images

Push to ACR automatically

Dockerfile (Example: API)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]

CI Pipeline (.github/workflows/ci.yml)
name: CI Pipeline

on:
  push:
    branches: [ main ]
    tags: [ "v*", "release-*", "build-*" ]

env:
  IMAGE_TAG: ${{ github.ref_name }}-${{ github.run_number }}

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}

    - run: az acr login --name acrrecruitmentprod

    - run: |
        docker build -t acrrecruitmentprod.azurecr.io/retail-recruitment:${IMAGE_TAG} .
        docker push acrrecruitmentprod.azurecr.io/retail-recruitment:${IMAGE_TAG}

Verify
az acr repository list --name acrrecruitmentprod

🔹 STEP 6 — Kubernetes Manifests (Base)
Purpose

Define application runtime

Use internal DNS

Avoid hardcoding

Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: recruitment

ConfigMap
DB_HOST: mysql
DB_PORT: "3306"
DB_NAME: capsule_db
DB_USER: capsule_user

🔹 STEP 7 — Helm Charts
Purpose

Package Kubernetes YAML

Support environments

Enable rollback

Helm Location (GitOps Repo)
recruitment-gitops/helm/recruitment/

values.yaml (FINAL)
namespace: recruitment

image:
  registry: acrrecruitmentprod.azurecr.io
  name: retail-recruitment
  tag: "8"

config:
  DB_HOST: mysql
  DB_PORT: "3306"
  DB_NAME: capsule_db
  DB_USER: capsule_user

secrets:
  DB_PASSWORD: secure_password_123

mysql:
  image: mysql:8.0
  persistence:
    size: 10Gi
    storageClass: azure-disk-sc

🔹 STEP 8 — Persistent Volume for MySQL (CRITICAL)
Purpose

Ensure database data survives pod restarts

StorageClass (templates/storageclass.yaml)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: azure-disk-sc
provisioner: disk.csi.azure.com
parameters:
  skuName: StandardSSD_LRS
reclaimPolicy: Retain

MySQL StatefulSet (templates/mysql-statefulset.yaml)
volumeClaimTemplates:
- metadata:
    name: mysql-data
  spec:
    storageClassName: azure-disk-sc
    accessModes: ["ReadWriteOnce"]
    resources:
      requests:
        storage: 10Gi


✔ Automatically creates PVC
✔ Replaces Docker volume capsule-mysql-data

Verify Persistence
kubectl get pvc -n recruitment
kubectl delete pod mysql-0 -n recruitment


✔ Data preserved

🔹 STEP 9 — GitOps with Argo CD
Purpose

Git = source of truth

No kubectl for prod

Argo CD Application
syncPolicy:
  automated:
    prune: true
    selfHeal: true


✔ Auto deploy
✔ Auto rollback

STEP 10 — Monitoring (Prometheus & Grafana)
Purpose

Observability

SRE-grade metrics

What is Monitored

Node CPU & memory

Pod health

Application performance

Resource usage

Verify
kubectl get pods -n monitoring
kubectl get svc -n monitoring

11️⃣ Security & Best Practices

No hardcoded IPs

RBAC-based access

GitOps only deployments

StatefulSet for DB

Resource limits & probes

Azure Disk CSI for storage

12️⃣ Final Deliverables

✔ Terraform code
✔ AKS cluster
✔ CI pipelines
✔ Helm charts
✔ GitOps CD
✔ Persistent MySQL
✔ Monitoring stack


Author:- Kamlesh Wamankar
