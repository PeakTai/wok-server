@echo off

chcp 65001

docker run -d --rm --name mysql_test -e MYSQL_ROOT_PASSWORD=abc123 ^
  -e MYSQL_DATABASE=test -p 3306:3306 mysql:8

echo "press any key to close"
pause>nul