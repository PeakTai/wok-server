# Unit Testing

To run the project's unit tests, you need to start the database services first, then run the tests.

## Start Database Services

The project source code provides scripts to start local database services for testing. The services need to run in Docker, so you must install docker-desktop locally first. Docker installation is not covered here; you can visit the official website for documentation.

First, start the MySQL service. This is simple - run docker-mysql.bat or docker-mysql.sh in the script directory.

```
./script/docker-mysql.sh
```

Then start the MongoDB service for testing. Run docker-mongo.bat or docker-mongo.sh in the script directory.

```
./script/docker-mongo.sh
```

Starting MongoDB alone is not sufficient. The service must be configured as a replica set to support transactions.

Run mongosh in the MongoDB container:

```
docker exec -it mongo_test mongosh
```

In mongosh, execute the following script to initialize as a replica set:

```js
rs.initiate({
  _id: 'rs0',
  members: [{ _id: 0, host: '127.0.0.1:27017' }]
})
```

Create a test user:

```js
db.createUser({
  user: 'test',
  pwd: 'abc123',
  roles: [{ role: 'readWrite', db: 'test' }]
})
```

After completing the above steps, the MongoDB service is ready for testing.

## Run Tests

Run the following script in the project root directory:

```
npm run test
```