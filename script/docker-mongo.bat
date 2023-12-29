@echo off

chcp 65001

@REM 启动一个临时的 mongodb 服务用于测试

@REM 暂时没有找到办法启动脚本能够自动创建副本集，只能在启动容器后进入手动执行脚本
@REM docker run --name mongo_test --rm -v  %cd%\mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js ^
@REM  -e MONGO_INITDB_DATABASE=test -p 27017:27017 mongo --replSet rs0
docker run --name mongo_test --rm -d -p 27017:27017 mongo --replSet rs0

echo "press any key to close"
pause>nul