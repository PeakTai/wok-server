# 单元测试

要把项目的单元测试跑起来，需要先启动数据库服务，然后再运行测试。

## 启动数据库服务

项目源码中有提供脚本来启动本地数据库服务，用于跑测试，服务需要运行在 docker 中，所以
必须在本地先安装 docker-desktop 。docker 的安装不再介绍，可以自行访问官网查看文档。

首先启动 mysql 服务，这个比较的简单，运行 script 目录下的 docker-mysql.bat 或 docker-mysql.sh 即可。

```
./script/docker-mysql.sh
```

然后启动测试用的 mongodb 服务，运行 script 目录下的 docker-mongo.bat 或 docker-mongo.sh。

```
./script/docker-mongo.sh
```

mongodb 光启动服务是不行的，必须要将启动的服务设置成副本集，这样才可以支持事务。

在 mongodb 服务的容器中运行 mongosh。

```
docker exec -it mongo_test mongosh
```

在 mongosh 中，执行下面的脚本，初始化成为副本集。

```js
rs.initiate({
  _id: 'rs0',
  members: [{ _id: 0, host: '127.0.0.1:27017' }]
})
```

创建测试帐号。

```js
db.createUser({
  user: 'test',
  pwd: 'abc123',
  roles: [{ role: 'readWrite', db: 'test' }]
})
```

做完上面的操作，mongodb 服务就可以用来跑测试了。

## 运行测试

在项目的根目录下运行下面的脚本。

```
npm run test
```