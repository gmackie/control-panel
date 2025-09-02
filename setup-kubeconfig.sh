#!/bin/bash

# Setup Kubeconfig for Control Panel Deployment
# This script helps configure kubectl to connect to your K3s/K8s cluster

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Kubernetes Cluster Configuration Helper${NC}"
echo -e "${BLUE}=======================================${NC}"
echo ""

# Function to test SSH connection
test_ssh_connection() {
    local server=$1
    if ssh -o ConnectTimeout=5 -o BatchMode=yes $server "echo 'SSH connection successful'" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Check if kubeconfig already exists
if [ -f "$HOME/.kube/config" ]; then
    echo -e "${YELLOW}Existing kubeconfig found at ~/.kube/config${NC}"
    read -p "Do you want to backup and replace it? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        mv ~/.kube/config ~/.kube/config.backup.$(date +%Y%m%d-%H%M%S)
        echo -e "${GREEN}✓ Backed up existing config${NC}"
    else
        echo "Using existing kubeconfig"
        export KUBECONFIG=$HOME/.kube/config
        kubectl cluster-info
        exit 0
    fi
fi

echo -e "${YELLOW}How would you like to configure kubectl?${NC}"
echo "1. Connect to K3s cluster via SSH"
echo "2. Connect to managed Kubernetes (GKE/EKS/AKS)"
echo "3. Use local K3s/K8s installation"
echo "4. Manually provide kubeconfig"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo -e "${YELLOW}K3s Cluster Configuration${NC}"
        read -p "Enter your server address (e.g., user@server.com or IP): " SERVER
        
        # Test SSH connection
        echo -e "${YELLOW}Testing SSH connection...${NC}"
        if ! test_ssh_connection $SERVER; then
            echo -e "${RED}❌ Cannot connect to $SERVER via SSH${NC}"
            echo "Please ensure:"
            echo "  - SSH access is configured"
            echo "  - The server address is correct"
            echo "  - Your SSH key is added to the server"
            exit 1
        fi
        
        echo -e "${GREEN}✓ SSH connection successful${NC}"
        
        # Get K3s config from server
        echo -e "${YELLOW}Fetching K3s configuration...${NC}"
        mkdir -p ~/.kube
        
        # Get the kubeconfig and update the server address
        ssh $SERVER "sudo cat /etc/rancher/k3s/k3s.yaml" > /tmp/k3s-config.yaml
        
        # Extract just the hostname/IP from the SERVER variable
        SERVER_HOST=$(echo $SERVER | cut -d'@' -f2)
        
        # Replace localhost with actual server address
        sed "s/127.0.0.1/$SERVER_HOST/g" /tmp/k3s-config.yaml > ~/.kube/config
        rm /tmp/k3s-config.yaml
        
        echo -e "${GREEN}✓ K3s configuration retrieved${NC}"
        ;;
        
    2)
        echo ""
        echo -e "${YELLOW}Managed Kubernetes Configuration${NC}"
        echo "Select your cloud provider:"
        echo "1. Google Cloud (GKE)"
        echo "2. Amazon Web Services (EKS)"
        echo "3. Microsoft Azure (AKS)"
        read -p "Enter choice (1-3): " cloud
        
        case $cloud in
            1)
                echo -e "${YELLOW}Configuring GKE access...${NC}"
                read -p "Enter cluster name: " CLUSTER_NAME
                read -p "Enter zone/region: " ZONE
                read -p "Enter project ID: " PROJECT
                
                gcloud container clusters get-credentials $CLUSTER_NAME \
                    --zone=$ZONE \
                    --project=$PROJECT
                ;;
            2)
                echo -e "${YELLOW}Configuring EKS access...${NC}"
                read -p "Enter cluster name: " CLUSTER_NAME
                read -p "Enter region: " REGION
                
                aws eks update-kubeconfig \
                    --name $CLUSTER_NAME \
                    --region $REGION
                ;;
            3)
                echo -e "${YELLOW}Configuring AKS access...${NC}"
                read -p "Enter resource group: " RG
                read -p "Enter cluster name: " CLUSTER_NAME
                
                az aks get-credentials \
                    --resource-group $RG \
                    --name $CLUSTER_NAME
                ;;
        esac
        ;;
        
    3)
        echo ""
        echo -e "${YELLOW}Local Cluster Configuration${NC}"
        
        # Check for K3s
        if [ -f "/etc/rancher/k3s/k3s.yaml" ]; then
            echo -e "${GREEN}✓ Found local K3s installation${NC}"
            mkdir -p ~/.kube
            sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
            sudo chown $USER:$USER ~/.kube/config
            
        # Check for K8s
        elif [ -f "/etc/kubernetes/admin.conf" ]; then
            echo -e "${GREEN}✓ Found local Kubernetes installation${NC}"
            mkdir -p ~/.kube
            sudo cp /etc/kubernetes/admin.conf ~/.kube/config
            sudo chown $USER:$USER ~/.kube/config
            
        else
            echo -e "${RED}❌ No local cluster configuration found${NC}"
            exit 1
        fi
        ;;
        
    4)
        echo ""
        echo -e "${YELLOW}Manual Configuration${NC}"
        echo "Please paste your kubeconfig content (press Ctrl+D when done):"
        mkdir -p ~/.kube
        cat > ~/.kube/config
        chmod 600 ~/.kube/config
        ;;
esac

# Test the connection
echo ""
echo -e "${YELLOW}Testing cluster connection...${NC}"
export KUBECONFIG=$HOME/.kube/config

if kubectl cluster-info >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Successfully connected to cluster!${NC}"
    echo ""
    kubectl cluster-info | head -1
    echo ""
    echo -e "${YELLOW}Cluster nodes:${NC}"
    kubectl get nodes
    echo ""
    echo -e "${GREEN}✓ Kubeconfig saved to ~/.kube/config${NC}"
    echo ""
    echo -e "${BLUE}You can now run the deployment:${NC}"
    echo "./deploy-to-cluster.sh"
else
    echo -e "${RED}❌ Failed to connect to cluster${NC}"
    echo "Please check your configuration and try again"
    exit 1
fi