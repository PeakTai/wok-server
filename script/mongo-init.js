// 容器启动成功后，进入容器执行下面的脚本
// docker exec -it mongo_test bash
// mongosh
rs.initiate({
  _id: 'rs0',
  members: [{ _id: 0, host: '127.0.0.1:27017' }]
})
db.createUser({
  user: 'test',
  pwd: 'abc123',
  roles: [{ role: 'readWrite', db: 'test' }]
})
