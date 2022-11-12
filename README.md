# REST API Engine

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![license-shield]][license-url]

Custom REST API Engine with extended capabilities

Features included:

**TODO**

- . . .

# Installation

- Option 1. Committing [update set](./releases/REST_API_Engine_002.xml)

## Technical solution

### Script includes

- `APIUtils()`: Contains the logic of the application.

![APIUtils UML](./README/APIUtils_uml.png)

#### Flow GET request

![Flow GET Request](./README/flow_get.png)

### Tables

| Table | Description |
| ----- | ----------- |
| REST API Configuration Table | Contains the configuration for a table |
| REST API Configuration Object | Contains the configuration for an object |

#### REST API Configuration Table - Attributes

| Attribute | Type | Default value | Example | Description |
| --------- | ---- | ------------- | ------- | ----------- |
| Number | String |  | CONFTBL0001001 | Human-readable record identifier |
| Table | Reference to *sys_db_object* |  | Opportunity[*u_opportunity*] | Main table in hand. REST requests linked to this configuration object performs mainly over this table. However is it possible to perform actions over different tables via scripts [More info](#) |
| Key | Reference to *sys_dictionary* |   | Number[*u_number*] | Human-readable **unique** attribute representing a record in the table in hand. (i.e.: *sys_user.user_name*, *task.number*) |
| Source | List of *sys_user* |   | Abel Tuter, David Loo | The current configuration object **only applies** for the selected users |
| Active | Boolean | true |   | Enable/disable the current record |
| Custom POST | Boolean | false |   | If enabled, the API Engine executes a custom script for the inserction of new records. If disabled, the API Engine executes `record.insert()` and do not run the custom script |
| Custom POSt Script | Script |   |   | Custom script executed if the above flag is enabled [More info](#) |

### Client scripts

- `Type changes`: Modify the behavior of the form view of the *REST API Configuration Object*.

![Type changes](./README/client_script_type_changes.gif)

### UI Policies

- `Custom POST`: Modify the behavior of the form view of the *REST API Configuration Table*.
- `Custom Validation`: Modify the behavior of the form view of the *REST API Configuration Table*.



[contributors-shield]: https://img.shields.io/github/contributors/AlexAlvarez092/SN-REST-API-Engine.svg?style=for-the-badge
[contributors-url]: https://github.com/AlexAlvarez092/SN-REST-API-Engine/graphs/contributors

[forks-shield]: https://img.shields.io/github/forks/AlexAlvarez092/SN-REST-API-Engine.svg?style=for-the-badge
[forks-url]: https://github.com/AlexAlvarez092/SN-REST-API-Engine/network/members

[stars-shield]: https://img.shields.io/github/stars/AlexAlvarez092/SN-REST-API-Engine.svg?style=for-the-badge
[stars-url]: https://github.com/gAlexAlvarez092/SN-REST-API-Engine/stargazers

[issues-shield]: https://img.shields.io/github/issues/AlexAlvarez092/SN-REST-API-Engine.svg?style=for-the-badge
[issues-url]: https://github.com/AlexAlvarez092/SN-REST-API-Engine/issues

[license-shield]: https://img.shields.io/github/license/AlexAlvarez092/SN-REST-API-Engine.svg?style=for-the-badge
[license-url]: https://github.com/AlexAlvarez092/SN-REST-API-Engine/blob/master/LICENSE.txt