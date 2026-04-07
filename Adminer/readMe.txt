YOU HAVE TO INSTALL 'DOCKER DESKTOP' FIRST

To run:
    To start: docker compose up -d
    To stop: docker compose down 

Login:
    needed info are within .env file of backend -> database_backend folder
    Server = DB_HOST (from .env)
    Username = viewer
    Password = viewerPassword
    Database = DB_NAME (from .env)

Also try to only interact with the left side buttons, such as 'select' and table names like 'UserData',
I made this as a table viewer and tried to restrict functionality,
but for functionalities not restricted, I rather not find out what they do tbh 

*measures were setup on the database level where changes are restricted but I haven't tested them 