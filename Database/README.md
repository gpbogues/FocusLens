Database currently hosted on ec2,
without adminer access, you can view within bash by ssh into ec2,
there, you cd to Database_backend and use 'sqlite3 focuslens.db'

Basic Commands:

.tables (view tales)
.schema (view schema)
select * from TableName (view table data)

for table data viewing, you can do,
.headers on
.mode column
to enchace clarity (kinda) 