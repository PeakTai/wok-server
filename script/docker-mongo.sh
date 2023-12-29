#!/usr/bin/env bash

# 启动一个临时的 mongodb 服务用于测试
# 服务启动完成后，需要手动执行初始化脚本 mongo-init.js 中的内容来创建副本集
docker run --name mongo_test --rm -d -p 27017:27017 mongo --replSet rs0
