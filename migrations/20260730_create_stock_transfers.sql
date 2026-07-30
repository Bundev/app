CREATE TABLE IF NOT EXISTS stock_transfers (
    id INT NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    request_key VARCHAR(128) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    from_store_id INT NOT NULL,
    to_store_id INT NOT NULL,
    from_store_name VARCHAR(255) NOT NULL,
    to_store_name VARCHAR(255) NOT NULL,
    created_by_user_id INT NOT NULL,
    created_by_name VARCHAR(255) NOT NULL,
    status ENUM('completed') NOT NULL DEFAULT 'completed',
    comment TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_stock_transfers_company_request (company_id, request_key),
    KEY idx_stock_transfers_company_created (company_id, created_at, id),
    KEY idx_stock_transfers_from_store (from_store_id, created_at),
    KEY idx_stock_transfers_to_store (to_store_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id INT NOT NULL AUTO_INCREMENT,
    transfer_id INT NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(255) NULL,
    product_unit VARCHAR(50) NULL,
    quantity INT NOT NULL,
    from_quantity_before INT NOT NULL,
    from_quantity_after INT NOT NULL,
    to_quantity_before INT NOT NULL,
    to_quantity_after INT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_stock_transfer_items_transfer_product (transfer_id, product_id),
    KEY idx_stock_transfer_items_product (product_id, transfer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
