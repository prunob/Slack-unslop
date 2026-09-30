# slack-unslop — Guide en français

Extension Chrome qui affiche le nom complet du profil Slack à la place du pseudo dans les auteurs et les mentions des messages lus. Par exemple, `@exemple_pseudo` devient `@Alex Exemple`, sans avoir à survoler les personnes.

Le nom complet est déclaratif : l’extension ne vérifie pas l’identité. Le changement concerne uniquement votre affichage. Les identifiants des destinataires des mentions restent inchangés.

## Installation

1. Télécharger et décompresser `dist/slack-unslop-0.1.1.zip` depuis le dépôt, ou utiliser directement son dossier `extension/`.
2. Ouvrir `chrome://extensions`, puis activer **Mode développeur**.
3. Cliquer sur **Charger l’extension non empaquetée** et choisir le dossier contenant `manifest.json`.
4. Recharger complètement les onglets Slack.

Chrome 111 ou ultérieur est requis. L’extension utilise Manifest V3 et n’est pas publiée sur le Chrome Web Store.

## Utilisation

Ouvrir une discussion Slack normalement. L’extension repère les identifiants des personnes et demande leurs profils avec la session Slack déjà active. Aucun survol, jeton à copier ou application Slack à créer n’est nécessaire. Plusieurs noms inconnus peuvent prendre quelques secondes à apparaître.

La fenêtre de l’extension affiche le nombre de noms connus et l’état de connexion. Le bouton d’activation permet de revenir immédiatement aux libellés d’origine.

Une correction manuelle reste disponible : indiquer l’identifiant du membre (`U…` ou `W…`), le nom complet et, éventuellement, le pseudo. Les corrections manuelles ont priorité sur les noms récupérés automatiquement.

## Import facultatif d’un annuaire

Si vous possédez déjà un export autorisé de `users.list`, importer son fichier JSON dans l’espace actif. Sinon, utiliser une liste fictive comme celle-ci comme modèle :

```json
{
  "team_id": "TTEST00001",
  "members": [
    {
      "id": "UTEST00001",
      "profile": {
        "real_name": "Alex Exemple",
        "display_name": "exemple_pseudo"
      }
    }
  ]
}
```

Ces identifiants et noms sont fictifs. Remplacer les valeurs uniquement dans votre fichier local. Si `team_id` est présent, il doit correspondre à l’espace actif. Les réponses paginées s’importent une page à la fois. Les corrections manuelles sont conservées.

## Mise à jour

Remplacer les fichiers du dossier déjà chargé, cliquer sur **Recharger** dans `chrome://extensions`, puis recharger Slack. Conserver le même dossier chargé permet de garder l’identité de l’extension et les réglages locaux.

## Limites

Cette version est expérimentale. Slack peut modifier son interface ou sa manière de gérer les sessions. L’accès automatique aux profils dépend de la disponibilité de la session dans la page et de la présence des identifiants dans l’interface.

Le composeur conserve les libellés Slack d’origine. Les blocs de code, les mentions collectives et les bots ne sont pas renommés. L’extension concerne Slack web dans Chrome, pas les applications desktop ou mobile. Un profil sans nom complet reste inchangé.

La version 0.1.1 corrige le crash de démarrage de 0.1.0 et comprend un test de régression. Les tests utilisent des données fictives ; ils ne garantissent pas la compatibilité de chaque espace réel.

Les noms et correspondances restent dans le stockage local de Chrome. Le jeton de session est utilisé en mémoire dans la page Slack et n’est pas conservé. Aucun service externe ne reçoit les profils. Voir la [documentation sur la confidentialité](PRIVACY.md).

Pour un signalement public, fournir la version et le message d’état, sans jeton, capture de discussion privée ni annuaire réel.
