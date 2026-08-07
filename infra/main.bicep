targetScope = 'subscription'

@minLength(1)
param environmentName string

param location string

param workloadLocation string = location

@minLength(1)
param resourceGroupName string

@description('Object ID of the deployment user for local Blob session upload access.')
param principalId string

param gmailConnectionAuthorized string = 'false'

@description('Gmail address that receives matching TV notifications.')
param emailRecipient string

@description('Email address that receives independent Azure Monitor failure alerts.')
param alertEmailAddress string

param emailSubject string = 'Samsung TV beschikbaar'

param emailBodyPrefix string = 'Ga naar de Samsung Multistore om je TV uit te zoeken. Ik heb deze gevonden:'

param excludedProductTerms string = ''

param tvSizeInches string = '55'

@secure()
param bootstrapSession string = ''

var tags = {
  'azd-env-name': environmentName
  workload: 'samsung-tv-monitor'
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-11-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module resources './resources.bicep' = {
  name: 'samsung-tv-monitor-resources'
  scope: resourceGroup
  params: {
    name: environmentName
    location: location
    workloadLocation: workloadLocation
    principalId: principalId
    gmailConnectionAuthorized: gmailConnectionAuthorized
    emailRecipient: emailRecipient
    alertEmailAddress: alertEmailAddress
    emailSubject: emailSubject
    emailBodyPrefix: emailBodyPrefix
    excludedProductTerms: excludedProductTerms
    tvSizeInches: tvSizeInches
    bootstrapSession: bootstrapSession
    tags: tags
  }
}

output AZURE_RESOURCE_GROUP string = resourceGroup.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = resources.outputs.containerRegistryEndpoint
output AZURE_CONTAINER_REGISTRY_NAME string = resources.outputs.containerRegistryName
output AZURE_CONTAINER_JOB_NAME string = resources.outputs.containerJobName
output AZURE_STORAGE_ACCOUNT string = resources.outputs.storageAccountName
output AZURE_STORAGE_CONTAINER string = resources.outputs.storageContainerName
output AZURE_LOGIC_APP_NAME string = resources.outputs.logicAppName
output AZURE_GMAIL_CONNECTION_NAME string = resources.outputs.gmailConnectionName
output AZURE_MONITOR_ACTION_GROUP_NAME string = resources.outputs.monitorActionGroupName
