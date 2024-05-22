CREATE TABLE
  book (
    id int AUTO_INCREMENT PRIMARY KEY,
    author_id VARCHAR(64) COMMENT '作者id',
    name VARCHAR(64) NOT NULL,
    visitors BIGINT UNSIGNED NOT NULL DEFAULT 0,
    create_at BIGINT UNSIGNED NOT NULL COMMENT '创建时间',
    update_at BIGINT UNSIGNED NOT NULL COMMENT '更新时间'
  ) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '书籍';


create INDEX
  `idx_book_name` on book (name);


-- 试题表，用于测试 json 
CREATE TABLE
  question (
    id VARCHAR(32) PRIMARY KEY,
    title VARCHAR(256) NOT NULL COMMENT '标题',
    options json NOT NULL COMMENT '选项列表，json 数组',
    question_setter json NOT NULL COMMENT '出题人信息，json 对象',
    create_at BIGINT UNSIGNED NOT NULL COMMENT '创建时间',
    update_at BIGINT UNSIGNED NOT NULL COMMENT '更新时间'
  ) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '试题';