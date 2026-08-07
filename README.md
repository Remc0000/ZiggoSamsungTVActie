# Ziggo Samsung TV Actie Monitor

Deze monitor controleert iedere 10 minuten de afgeschermde Nederlandse Samsung
Multistore en stuurt een Gmail-bericht zodra een passende televisie beschikbaar
is. De controle draait als Azure Container Apps Job en blijft dus werken als je
laptop uitstaat.

De Ziggo-actie staat beschreven op
[ziggo.nl/campagne/gratis-tv](https://www.ziggo.nl/campagne/gratis-tv). Volgens
die pagina ontvang je na betaling van de eerste factuur per e-mail een voucher
met Samsung-toegangscode. De genoemde 55-inch modellen zijn
`UE55M74HAUXXN` en `UE55M1EHAUXXN`; de toegangscode is te gebruiken tot en met
30 juni 2027.

> Dit is een onafhankelijk communityproject en is niet ontwikkeld of
> ondersteund door Ziggo of Samsung. Actievoorwaarden, modellen en
> beschikbaarheid kunnen veranderen.

## Wat wordt er gedeployd?

- Een geplande Azure Container Apps Job met Node.js, TypeScript en Playwright.
- Een privé-opslagaccount voor de Samsung-browsersessie en verzendhistorie.
- Een Logic App met een Gmail-verbinding voor TV-meldingen.
- Een Azure Container Registry voor de monitorimage.
- Log Analytics en Application Insights.
- Azure Monitor-waarschuwingen bij 30 minuten zonder succesvolle scan en bij
  een mislukte e-mailworkflow.
- Een managed identity met minimaal benodigde Azure-rollen.

De repository bevat **geen** Samsung-wachtwoord, Gmail-token, browsersessie,
Azure-subscription-id of persoonlijk e-mailadres. Iedere gebruiker koppelt zijn
eigen accounts.

## Benodigdheden

1. Een geldige Ziggo/Samsung Multistore-toegangscode.
2. Een Samsung-account waarmee de Multistore-catalogus zichtbaar is.
3. Een Gmail-account dat meldingen mag versturen.
4. Een Azure-subscription waarin je resources mag aanmaken.
5. Windows met Microsoft Edge, PowerShell 7, Node.js 22 of nieuwer, Git,
   [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) en
   [Azure Developer CLI](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd).

## 1. Repository ophalen

```powershell
git clone https://github.com/Remc0000/ZiggoSamsungTVActie.git
Set-Location .\ZiggoSamsungTVActie
npm --prefix .\src\monitor install
```

Meld je daarna aan:

```powershell
az login
azd auth login
```

## 2. Eigen instellingen configureren

Maak een lokale AZD-omgeving:

```powershell
azd env new samsung-tv --no-prompt
```

Vul je eigen waarden in. Deze worden lokaal onder `.azure\` opgeslagen en
worden niet naar GitHub gecommit.

```powershell
$subscriptionId = az account show --query id --output tsv
$principalId = az ad signed-in-user show --query id --output tsv

azd env set AZURE_SUBSCRIPTION_ID $subscriptionId
azd env set AZURE_LOCATION westeurope
azd env set WORKLOAD_LOCATION northeurope
azd env set AZURE_RESOURCE_GROUP_NAME ZiggoSamsungTVActie
azd env set AZURE_PRINCIPAL_ID $principalId

azd env set EMAIL_RECIPIENT "jouw-adres@gmail.com"
azd env set ALERT_EMAIL_ADDRESS "jouw-adres@gmail.com"
azd env set EMAIL_SUBJECT "Samsung TV beschikbaar"
azd env set EMAIL_BODY_PREFIX "Ga naar de Samsung Multistore; deze TV is beschikbaar:"

azd env set TV_SIZE_INCHES "55"
azd env set EXCLUDED_PRODUCT_TERMS ""
azd env set GMAIL_CONNECTION_AUTHORIZED "false"
azd env set BOOTSTRAP_SESSION ""
```

### Instelbare waarden

| Waarde | Betekenis | Voorbeeld |
|---|---|---|
| `EMAIL_RECIPIENT` | Ontvanger van TV-meldingen | `jouw-adres@gmail.com` |
| `ALERT_EMAIL_ADDRESS` | Ontvanger van technische storingsmeldingen | `jouw-adres@gmail.com` |
| `EMAIL_SUBJECT` | Onderwerp van de TV-melding | `Samsung TV beschikbaar` |
| `EMAIL_BODY_PREFIX` | Tekst vóór de productbeschrijving | Vrije tekst |
| `TV_SIZE_INCHES` | Gewenste schermmaat | `55` of `65` |
| `EXCLUDED_PRODUCT_TERMS` | Komma-gescheiden kenmerken van één ongewenst model | `ls03fw,2025` |
| `AZURE_LOCATION` | Regio voor dataresources | `westeurope` |
| `WORKLOAD_LOCATION` | Regio voor de Container Apps Job | `northeurope` |

Alle ingevulde uitsluitingstermen moeten samen in een product voorkomen voordat
dat product wordt overgeslagen. Laat de waarde leeg als ieder model van de
gekozen schermmaat interessant is.

## 3. Azure-resources deployen

```powershell
azd up --no-prompt
```

De deployment maakt de infrastructuur aan en bouwt de containerimage op afstand
in Azure Container Registry.

## 4. Eigen Gmail-account koppelen

De eerste deployment maakt bewust nog geen actieve Gmail-actie aan.

1. Open de door `azd up` getoonde resourcegroep in de Azure Portal.
2. Open de API Connection waarvan de naam met `gmail-` begint.
3. Kies **Edit API connection**.
4. Kies **Authorize** en meld je aan met het Gmail-account dat de berichten
   moet versturen.
5. Kies **Save**.
6. Activeer daarna de e-mailactie:

```powershell
azd env set GMAIL_CONNECTION_AUTHORIZED "true"
azd provision --no-prompt
```

De Gmail-autorisatie blijft in jouw Azure-omgeving en staat niet in deze
repository.

## 5. Inloggen bij de Samsung Multistore

Voer uit:

```powershell
.\scripts\setup-samsung-session.ps1
```

Het script opent een gewone Microsoft Edge-sessie. Dit is expres geen
geautomatiseerd browservenster, omdat Google- of Samsung-login
automatiseringsbrowsers kan weigeren.

1. Log in met je eigen Samsung-account.
2. Vul indien nodig je persoonlijke Multistore-toegangscode in.
3. Controleer dat je de TV-catalogus ziet.
4. Sluit daarna alle vensters van deze Edge-sessie.

Het script exporteert alleen de ingelogde browsersessie, comprimeert deze en zet
haar als eenmalig lokaal AZD-geheim klaar. Je wachtwoord wordt niet opgeslagen.

Deploy het tijdelijke bootstrapgeheim:

```powershell
azd provision --no-prompt
```

Start vervolgens één handmatige controle:

```powershell
$job = azd env get-value AZURE_CONTAINER_JOB_NAME
$resourceGroup = azd env get-value AZURE_RESOURCE_GROUP
az containerapp job start --name $job --resource-group $resourceGroup
```

Wanneer deze uitvoering is geslaagd, staat de sessie in het privé-opslagaccount.
Verwijder daarna het eenmalige bootstrapgeheim:

```powershell
azd env set BOOTSTRAP_SESSION ""
azd provision --no-prompt
```

Herhaal deze stap wanneer de Samsung-sessie later verloopt.

## 6. Controleren of alles werkt

Bekijk recente jobuitvoeringen:

```powershell
$job = azd env get-value AZURE_CONTAINER_JOB_NAME
$resourceGroup = azd env get-value AZURE_RESOURCE_GROUP
az containerapp job execution list --name $job --resource-group $resourceGroup --output table
```

De monitor logt per controle onder andere:

- het totale aantal beschikbare TV's;
- de ingestelde schermmaat;
- het aantal passende TV's;
- model, prijs en product-URL;
- of al een melding voor het model is verstuurd.

Azure Monitor mailt `ALERT_EMAIL_ADDRESS` wanneer 30 minuten geen succesvolle
controle is vastgelegd of wanneer de Gmail-workflow mislukt. Deze technische
melding wordt door Azure Monitor verstuurd en is dus onafhankelijk van de
Gmail-verbinding.

## Privacy en beveiliging

- Commit nooit `src\monitor\.local\storage-state.json`.
- Deel nooit de waarde van `BOOTSTRAP_SESSION`.
- De Samsung-sessie geeft toegang tot je account en moet als geheim worden
  behandeld.
- Blob Storage heeft geen publieke toegang.
- De monitor gebruikt managed identity in plaats van opgeslagen Azure-sleutels.
- De Logic App callback-URL wordt als Container Apps-geheim opgeslagen.
- Verwijder Azure-resources wanneer je de monitor niet meer gebruikt:

```powershell
azd down
```

Controleer vóór bevestiging zorgvuldig welke resources worden verwijderd.

## Ontwikkelen

```powershell
npm --prefix .\src\monitor run build
npm --prefix .\src\monitor test
az bicep build --file .\infra\main.bicep
```

## Licentie

Dit project is beschikbaar onder de [MIT-licentie](LICENSE).
