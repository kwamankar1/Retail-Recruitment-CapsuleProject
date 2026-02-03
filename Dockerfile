name: CI - Build & Push Docker Image

on:
  push:
    branches:
      - master
    tags:
      - "v*"
      - "release-*"
      - "build-*"

env:
  IMAGE_TAG: ${{ github.run_number }}

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Azure Login
      uses: azure/login@v2
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}

    - name: Login to ACR
      run: |
        az acr login --name acrrecruitmentprod

    - name: Build & Push Image
      run: |
        IMAGE=acrrecruitmentprod.azurecr.io/retail-recruitment:${IMAGE_TAG}
        docker build -t $IMAGE .
        docker push $IMAGE
