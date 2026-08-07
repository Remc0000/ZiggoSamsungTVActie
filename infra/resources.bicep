targetScope = 'resourceGroup'

@minLength(1)
param name string

param location string = resourceGroup().location

param workloadLocation string = location

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

param tags object = {}

var suffix = take(uniqueString(subscription().id, resourceGroup().id, name, location), 6)
var workloadSuffix = take(
  uniqueString(subscription().id, resourceGroup().id, name, workloadLocation),
  6
)
var normalizedName = toLower(replace(name, '-', ''))
var containerRegistryName = take('cr${normalizedName}${suffix}', 50)
var storageAccountName = take('st${normalizedName}${suffix}', 24)
var identityName = take('id-${name}-${suffix}', 128)
var workspaceName = take('log-${name}-${suffix}', 63)
var appInsightsName = 'appi-${name}-${suffix}'
var virtualNetworkName = 'vnet-${name}-${workloadSuffix}'
var privateDnsZoneName = 'privatelink.blob.${environment().suffixes.storage}'
var privateEndpointName = 'pe-blob-${name}-${workloadSuffix}'
var blobPrivateEndpointIpAddress = '10.42.2.4'
var containerEnvironmentName = take('cae-private-${name}-${workloadSuffix}', 60)
var containerJobName = take('caaj-private-${name}-${workloadSuffix}', 32)
var logicAppName = 'logic-${name}-${suffix}'
var gmailConnectionName = 'gmail-${name}-${suffix}'
var monitorActionGroupName = 'ag-${name}-${suffix}'
var heartbeatAlertName = 'alert-${name}-scan-heartbeat'
var logicAppFailureAlertName = 'alert-${name}-email-failure'
var storageContainerName = 'monitor'
var serviceTags = union(tags, { 'azd-service-name': 'monitor' })
var gmailEnabled = toLower(gmailConnectionAuthorized) == 'true'
var bootstrapSessionConfigured = !empty(bootstrapSession)

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
  tags: tags
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2025-02-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: virtualNetworkName
  location: workloadLocation
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.42.0.0/16'
      ]
    }
  }
}

resource containerAppsSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' = {
  parent: virtualNetwork
  name: 'snet-container-apps'
  properties: {
    addressPrefix: '10.42.0.0/23'
    delegations: [
      {
        name: 'container-apps-delegation'
        properties: {
          serviceName: 'Microsoft.App/environments'
        }
      }
    ]
  }
}

resource privateEndpointSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' = {
  parent: virtualNetwork
  name: 'snet-private-endpoints'
  properties: {
    addressPrefix: '10.42.2.0/27'
    privateEndpointNetworkPolicies: 'Disabled'
  }
}

resource blobPrivateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: privateDnsZoneName
  location: 'global'
  tags: tags
}

resource blobPrivateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: blobPrivateDnsZone
  name: 'link-${virtualNetworkName}'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetwork.id
    }
  }
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: containerRegistryName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    dataEndpointEnabled: false
    networkRuleBypassOptions: 'AzureServices'
    publicNetworkAccess: 'Enabled'
    policies: {
      quarantinePolicy: {
        status: 'disabled'
      }
      retentionPolicy: {
        days: 7
        status: 'disabled'
      }
      trustPolicy: {
        status: 'disabled'
        type: 'Notary'
      }
    }
  }
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2025-01-01' = {
  name: storageAccountName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowCrossTenantReplication: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Disabled'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Deny'
    }
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2025-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource monitorContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-01-01' = {
  parent: blobService
  name: storageContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource blobPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: privateEndpointName
  location: workloadLocation
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointSubnet.id
    }
    ipConfigurations: [
      {
        name: 'blob'
        properties: {
          groupId: 'blob'
          memberName: 'blob'
          privateIPAddress: blobPrivateEndpointIpAddress
        }
      }
    ]
    privateLinkServiceConnections: [
      {
        name: 'blob-storage'
        properties: {
          privateLinkServiceId: storageAccount.id
          groupIds: [
            'blob'
          ]
        }
      }
    ]
  }
}

resource blobPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: blobPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'blob'
        properties: {
          privateDnsZoneId: blobPrivateDnsZone.id
        }
      }
    ]
  }
  dependsOn: [
    blobPrivateDnsLink
  ]
}

// Keep the record declarative because deleting another endpoint for the same
// storage account can remove the zone-group-managed record.
resource blobPrivateDnsRecord 'Microsoft.Network/privateDnsZones/A@2024-06-01' = {
  parent: blobPrivateDnsZone
  name: storageAccount.name
  properties: {
    ttl: 10
    aRecords: [
      {
        ipv4Address: blobPrivateEndpointIpAddress
      }
    ]
  }
  dependsOn: [
    blobPrivateDnsZoneGroup
  ]
}

resource containerEnvironment 'Microsoft.App/managedEnvironments@2025-01-01' = {
  name: containerEnvironmentName
  location: workloadLocation
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: containerAppsSubnet.id
      internal: false
    }
    zoneRedundant: false
  }
}

resource gmailConnection 'Microsoft.Web/connections@2016-06-01' = {
  name: gmailConnectionName
  location: location
  tags: tags
  properties: {
    displayName: 'Samsung TV Monitor Gmail'
    api: {
      id: subscriptionResourceId(
        'Microsoft.Web/locations/managedApis',
        location,
        'gmail'
      )
    }
  }
}

var logicDefinitionParameters = gmailEnabled
  ? {
      '$connections': {
        defaultValue: {}
        type: 'Object'
      }
    }
  : {}

var logicWorkflowParameters = gmailEnabled
  ? {
      '$connections': {
        value: {
          gmail: {
            connectionId: gmailConnection.id
            connectionName: gmailConnection.name
            id: subscriptionResourceId(
              'Microsoft.Web/locations/managedApis',
              location,
              'gmail'
            )
          }
        }
      }
    }
  : {}

var logicActions = gmailEnabled
  ? {
      Send_email: {
        type: 'ApiConnection'
        runAfter: {}
        inputs: {
          host: {
            connection: {
              name: '@parameters(\'$connections\')[\'gmail\'][\'connectionId\']'
            }
          }
          method: 'post'
          path: '/v2/Mail'
          body: {
            To: '@triggerBody()?[\'to\']'
            Subject: '@triggerBody()?[\'subject\']'
            Body: '@triggerBody()?[\'message\']'
          }
        }
      }
      Response: {
        type: 'Response'
        runAfter: {
          Send_email: [
            'Succeeded'
          ]
        }
        inputs: {
          statusCode: 202
          body: {
            accepted: true
          }
        }
      }
    }
  : {
      Response: {
        type: 'Response'
        runAfter: {}
        inputs: {
          statusCode: 503
          body: {
            accepted: false
            message: 'Authorize the Gmail connection before enabling notifications.'
          }
        }
      }
    }

resource logicApp 'Microsoft.Logic/workflows@2019-05-01' = {
  name: logicAppName
  location: location
  tags: tags
  properties: {
    state: 'Enabled'
    definition: {
      '$schema': 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#'
      contentVersion: '1.0.0.0'
      parameters: logicDefinitionParameters
      triggers: {
        manual: {
          type: 'Request'
          kind: 'Http'
          inputs: {
            schema: {
              type: 'object'
              required: [
                'to'
                'subject'
                'message'
              ]
              properties: {
                to: {
                  type: 'string'
                }
                subject: {
                  type: 'string'
                }
                message: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
      actions: logicActions
      outputs: {}
    }
    parameters: logicWorkflowParameters
  }
}

resource monitorActionGroup 'Microsoft.Insights/actionGroups@2022-06-01' = {
  name: monitorActionGroupName
  location: 'Global'
  tags: tags
  properties: {
    groupShortName: 'SamsungTV'
    enabled: true
    emailReceivers: [
      {
        name: 'Samsung TV owner'
        emailAddress: alertEmailAddress
        useCommonAlertSchema: true
      }
    ]
  }
}

resource scanHeartbeatAlert 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = {
  name: heartbeatAlertName
  location: location
  kind: 'LogAlert'
  tags: tags
  properties: {
    displayName: 'Samsung TV monitor has stopped scanning'
    description: 'No successful Samsung TV scan was recorded during the last 30 minutes.'
    severity: 1
    enabled: true
    evaluationFrequency: 'PT10M'
    windowSize: 'PT30M'
    scopes: [
      logAnalytics.id
    ]
    criteria: {
      allOf: [
        {
          query: 'ContainerAppConsoleLogs_CL | where ContainerJobName_s == "${containerJobName}" | where Log_s has \'"event":"scan_complete"\' | summarize HeartbeatCount = count()'
          metricMeasureColumn: 'HeartbeatCount'
          timeAggregation: 'Total'
          operator: 'LessThan'
          threshold: 1
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        monitorActionGroup.id
      ]
      actionProperties: {
        'Email.Subject': 'Samsung TV monitor controleert de website niet meer'
      }
    }
    autoMitigate: true
    checkWorkspaceAlertsStorageConfigured: false
    skipQueryValidation: false
  }
}

resource logicAppFailureAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: logicAppFailureAlertName
  location: 'global'
  tags: tags
  properties: {
    description: 'The Samsung TV notification workflow could not send an email.'
    severity: 1
    enabled: true
    scopes: [
      logicApp.id
    ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'FailedLogicAppRuns'
          criterionType: 'StaticThresholdCriterion'
          metricName: 'RunsFailed'
          metricNamespace: 'Microsoft.Logic/workflows'
          operator: 'GreaterThan'
          threshold: 0
          timeAggregation: 'Total'
          skipMetricValidation: false
        }
      ]
    }
    actions: [
      {
        actionGroupId: monitorActionGroup.id
      }
    ]
    autoMitigate: true
    targetResourceType: 'Microsoft.Logic/workflows'
    targetResourceRegion: location
  }
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, identity.id, 'acrpull')
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    )
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource storageDataRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, identity.id, 'storage-blob-data-contributor')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
    )
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource deploymentUserStorageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, principalId, 'deployment-user-storage-access')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
    )
    principalId: principalId
    principalType: 'User'
  }
}

resource containerJob 'Microsoft.App/jobs@2025-01-01' = {
  name: containerJobName
  location: workloadLocation
  tags: serviceTags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    environmentId: containerEnvironment.id
    configuration: {
      replicaRetryLimit: 1
      replicaTimeout: 300
      triggerType: 'Schedule'
      scheduleTriggerConfig: {
        cronExpression: '*/10 * * * *'
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: identity.id
        }
      ]
      secrets: concat(
        [
          {
            name: 'logic-app-callback-url'
            value: listCallbackUrl(
              '${logicApp.id}/triggers/manual',
              '2019-05-01'
            ).value
          }
        ],
        bootstrapSessionConfigured
          ? [
              {
                name: 'bootstrap-session'
                value: bootstrapSession
              }
            ]
          : []
      )
    }
    template: {
      containers: [
        {
          name: 'monitor'
          image: 'mcr.microsoft.com/azurelinux/base/core:3.0'
          resources: {
            cpu: json('1.0')
            memory: '2Gi'
          }
          env: concat(
            [
              {
                name: 'AZURE_CLIENT_ID'
                value: identity.properties.clientId
              }
              {
                name: 'AZURE_STORAGE_ACCOUNT'
                value: storageAccount.name
              }
              {
                name: 'AZURE_STORAGE_CONTAINER'
                value: storageContainerName
              }
              {
                name: 'LOGIC_APP_CALLBACK_URL'
                secretRef: 'logic-app-callback-url'
              }
              {
                name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
                value: applicationInsights.properties.ConnectionString
              }
              {
                name: 'SAMSUNG_TARGET_URL'
                value: 'https://www.samsung.com/nl/multistore/nld/'
              }
              {
                name: 'EXCLUDED_PRODUCT_TERMS'
                value: excludedProductTerms
              }
              {
                name: 'TV_SIZE_INCHES'
                value: tvSizeInches
              }
              {
                name: 'EMAIL_RECIPIENT'
                value: emailRecipient
              }
              {
                name: 'EMAIL_SUBJECT'
                value: emailSubject
              }
              {
                name: 'EMAIL_BODY_PREFIX'
                value: emailBodyPrefix
              }
            ],
            bootstrapSessionConfigured
              ? [
                  {
                    name: 'BOOTSTRAP_SESSION_GZIP_BASE64'
                    secretRef: 'bootstrap-session'
                  }
                ]
              : []
          )
        }
      ]
    }
  }
  dependsOn: [
    acrPullRole
    storageDataRole
    monitorContainer
    blobPrivateDnsRecord
  ]
}

output containerRegistryEndpoint string = containerRegistry.properties.loginServer
output containerRegistryName string = containerRegistry.name
output containerJobName string = containerJob.name
output storageAccountName string = storageAccount.name
output storageContainerName string = monitorContainer.name
output logicAppName string = logicApp.name
output gmailConnectionName string = gmailConnection.name
output monitorActionGroupName string = monitorActionGroup.name
