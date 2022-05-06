# Prepare development environment

## Coding
Clone, then run:
```shell
$ npm install
```

To check style:
```shell
$ npm run eslint
```

To *fix* automatically where possible:
```shell
$ npm run eslintfix
```

TODO: precommit with autofix

## Licenses

The app is licensed under GPLv3 or later, which may constrain which libraries can be used.  Verify that all *production* modules are compatible with

```shell
npm exec license-check
```

The list of acceptable licenses is configured in the license-check script command in package.json.  If non-listed licenses show up, license-check will fail; check the license and if it is compatible with GPLv3 (see http://www.gnu.org/licenses/license-list.html for guidance) then add it to the list.  If it is not, find an alternative or rewrite as needed.

The license-check does not need to be performend on development-only modules because we are not further distributing them, they are only pulled *by* the developer into their development environment, i.e. someone else has distributed them to the developer and is responsible for ensuring the distribution is legal, and they are then used locally for development purposes.

## Builds
As well as a basic wine + mono install, on Ubuntu 20.04, we also need the following to be able to build a Windows distribution:
* libmono-windowsbase4.0-cil
* libmono-system-componentmodel-composition4.0-cil
* libmono-system-componentmodel-dataannotations4.0-cil
* libmono-microsoft-build4.0-cil
* libmono-system-xml-linq4.0-cil
* libmono-system-data-services4.0-cil
* libmono-microsoft-csharp4.0-cil
* libmono-system-io-compression-filesystem4.0-cil

There may be some over-arching package that will include these, but it's not clear what that might be; these were discovered empirically in the order shown
