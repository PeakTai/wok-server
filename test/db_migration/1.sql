CREATE TABLE
  user (
    id VARCHAR(32) PRIMARY KEY,
    nickname VARCHAR(64) NOT NULL COMMENT '昵称',
    balance BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '余额',
    active TINYINT(1) UNSIGNED NOT NULL DEFAULT 0 COMMENT '是否激活',
    create_at datetime(3) NOT NULL COMMENT '创建时间',
    update_at datetime(3) NOT NULL COMMENT '更新时间'
  ) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '用户表';


create UNIQUE INDEX uk_user_nickname on user (nickname);


# 预置数据
insert into
  user(id, nickname, create_at, update_at)
values
  ('admin001', 'admin', now(), now());


# 一部分测试数据，用于单元测试
insert into
  user(id, nickname, create_at, update_at)
values
  ('t001', 'test-one', now(), now());


insert into
  user(id, nickname, create_at, update_at)
values
  ('t002', 'test-two', now(), now());