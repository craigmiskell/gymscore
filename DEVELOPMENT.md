As well as a basic wine + mono install, on Ubuntu 20.04, also needs the following to be able to build a Windows distribution:
* libmono-windowsbase4.0-cil
* libmono-system-componentmodel-composition4.0-cil
* libmono-system-componentmodel-dataannotations4.0-cil
* libmono-microsoft-build4.0-cil
* libmono-system-xml-linq4.0-cil
* libmono-system-data-services4.0-cil
* libmono-microsoft-csharp4.0-cil
* libmono-system-io-compression-filesystem4.0-cil

There may be some over-arching package that will include these, but it's not clear what that might be; these were discovered empirically in the order shown
