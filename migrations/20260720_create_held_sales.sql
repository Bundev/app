CREATE TABLE IF NOT EXISTS held_sales (
    id INT NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    user_id INT NOT NULL,
    customer_id INT NULL,
    customer_name VARCHAR(255) NOT NULL DEFAULT 'Основной покупатель',
    items JSON NOT NULL,
    payment_method ENUM('cash', 'card', 'transfer') NOT NULL DEFAULT 'cash',
    cash_received DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
    comment TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_held_sales_company_user_updated (company_id, user_id, updated_at)
);
