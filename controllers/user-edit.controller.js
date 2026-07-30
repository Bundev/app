const bcrypt = require('bcrypt');
const fs = require('fs/promises');

const db = require('../config/db');
const uploadUser = require('../config/uploadUser');
const page = require('../helpers/page');

const ALLOWED_ROLES = new Set([
    'admin',
    'manager',
    'seller'
]);

class EmployeeEditError extends Error {}

function text(value, maxLength) {
    return String(value ?? '')
        .trim()
        .slice(0, maxLength);
}

function normalizeStoreIds(value) {
    const values = Array.isArray(value)
        ? value
        : value
            ? [value]
            : [];

    return [...new Set(
        values
            .map(item => Number(item))
            .filter(item => Number.isSafeInteger(item) && item > 0)
    )];
}

function isValidDate(value) {
    if (!value) {
        return true;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
        return false;
    }

    const date = new Date(
        Date.UTC(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3])
        )
    );

    return date.getUTCFullYear() === Number(match[1])
        && date.getUTCMonth() === Number(match[2]) - 1
        && date.getUTCDate() === Number(match[3]);
}

function formValues(body = {}) {
    return {
        name: text(body.name, 100),
        login: text(body.login, 100),
        email: text(body.email, 255),
        phone: text(body.phone, 20),
        role: text(body.role, 20),
        salary: text(body.salary, 20),
        position: text(body.position, 100),
        hire_date: text(body.hire_date, 10),
        birth_date: text(body.birth_date, 10),
        notes: text(body.notes, 10000),
        store_ids: normalizeStoreIds(
            body.stores ?? body.store_ids
        )
    };
}

function validate(values, password) {
    if (!values.name) {
        return 'Укажите имя сотрудника.';
    }

    if (!values.login) {
        return 'Укажите логин сотрудника.';
    }

    if (!ALLOWED_ROLES.has(values.role)) {
        return 'Выберите допустимую роль сотрудника.';
    }

    if (
        values.email
        && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)
    ) {
        return 'Укажите корректный email.';
    }

    if (!isValidDate(values.hire_date)) {
        return 'Укажите корректную дату приёма на работу.';
    }

    if (!isValidDate(values.birth_date)) {
        return 'Укажите корректную дату рождения.';
    }

    if (!values.store_ids.length) {
        return 'Выберите хотя бы один активный магазин.';
    }

    if (values.salary) {
        const salary = Number(values.salary);

        if (
            !Number.isFinite(salary)
            || salary < 0
            || salary > 99999999.99
        ) {
            return 'Зарплата должна быть числом от 0 до 99 999 999,99.';
        }
    }

    if (password) {
        if (password.length < 6) {
            return 'Новый пароль должен содержать не менее 6 символов.';
        }

        if (Buffer.byteLength(password, 'utf8') > 72) {
            return 'Новый пароль слишком длинный.';
        }
    }

    return null;
}

async function discardUploadedAvatar(file) {
    if (!file?.path) {
        return;
    }

    try {
        await fs.unlink(file.path);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(
                'Не удалось удалить загруженный аватар:',
                error
            );
        }
    }
}

function saveFormError(req, message, values) {
    req.session.userEditError = message;
    req.session.userEditValues = values;
}

exports.uploadAvatar = (req, res, next) => {
    uploadUser.single('avatar')(req, res, error => {
        if (!error) {
            return next();
        }

        const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'Размер аватара не должен превышать 5 МБ.'
            : error.message || 'Не удалось загрузить аватар.';

        const savedValues = formValues(req.body);

        // Поля, расположенные после файла, Multer мог ещё не прочитать.
        // В таком случае оставляем текущие назначения магазинов.
        delete savedValues.store_ids;

        saveFormError(req, message, savedValues);

        return res.redirect(
            `/user/${req.params.id}/edit`
        );
    });
};

exports.show = async (req, res) => {
    const employeeId = Number(req.params.id);
    const companyId = req.session.user.company_id;

    if (
        !Number.isSafeInteger(employeeId)
        || employeeId <= 0
    ) {
        return res.status(404).send('Сотрудник не найден.');
    }

    try {
        const [[employeeRows], [stores]] = await Promise.all([
            db.execute(
                `
                SELECT
                    id,
                    login,
                    name,
                    role,
                    status,
                    avatar,
                    email,
                    phone,
                    notes,
                    salary,
                    DATE_FORMAT(hire_date, '%Y-%m-%d') AS hire_date,
                    DATE_FORMAT(birth_date, '%Y-%m-%d') AS birth_date,
                    position
                FROM user
                WHERE id = ?
                  AND company_id = ?
                LIMIT 1
                `,
                [
                    employeeId,
                    companyId
                ]
            ),
            db.execute(
                `
                SELECT
                    s.id,
                    s.name,
                    s.status,
                    CASE
                        WHEN us.user_id IS NULL THEN 0
                        ELSE 1
                    END AS selected
                FROM stores s
                LEFT JOIN user_stores us
                    ON us.store_id = s.id
                   AND us.user_id = ?
                WHERE s.company_id = ?
                  AND (
                      s.status = 'active'
                      OR us.user_id IS NOT NULL
                  )
                ORDER BY
                    s.status = 'active' DESC,
                    s.name,
                    s.id
                `,
                [
                    employeeId,
                    companyId
                ]
            )
        ]);

        const employee = employeeRows[0];

        if (!employee) {
            return res.status(404).send('Сотрудник не найден.');
        }

        const initialValues = {
            name: employee.name || '',
            login: employee.login || '',
            email: employee.email || '',
            phone: employee.phone || '',
            role: employee.role || 'seller',
            salary: employee.salary ?? '',
            position: employee.position || '',
            hire_date: employee.hire_date || '',
            birth_date: employee.birth_date || '',
            notes: employee.notes || '',
            store_ids: stores
                .filter(store => Boolean(store.selected))
                .map(store => Number(store.id))
        };
        const savedValues = req.session.userEditValues || null;
        const editError = req.session.userEditError || null;
        const displayedValues = savedValues
            ? {
                ...initialValues,
                ...savedValues
            }
            : initialValues;
        const hasSavedStoreIds = savedValues
            && Object.prototype.hasOwnProperty.call(
                savedValues,
                'store_ids'
            );

        delete req.session.userEditValues;
        delete req.session.userEditError;

        return res.render('user_edit', {
            titleKey: 'title.user_edit',
            activeMenu: 'settings',
            employee,
            stores,
            formValues: displayedValues,
            selectedStoreIds: hasSavedStoreIds
                ? normalizeStoreIds(savedValues.store_ids)
                : initialValues.store_ids,
            editError,
            isSelf: employeeId === Number(req.session.user.id),
            ...page(req, 'user_new', [
                {
                    title: req.__('title.settings'),
                    url: '/settings?tab=users'
                },
                {
                    title: employee.name || 'Сотрудник',
                    url: `/user/${employee.id}`
                },
                {
                    title: 'Редактирование'
                }
            ])
        });
    } catch (error) {
        console.error(
            'Ошибка открытия формы сотрудника:',
            error
        );

        return res.status(500).send(
            'Не удалось открыть форму сотрудника.'
        );
    }
};

exports.update = async (req, res) => {
    const employeeId = Number(req.params.id);
    const companyId = req.session.user.company_id;
    const values = formValues(req.body);
    const password = String(req.body.password || '');
    const validationError = validate(values, password);

    if (
        !Number.isSafeInteger(employeeId)
        || employeeId <= 0
    ) {
        await discardUploadedAvatar(req.file);
        return res.status(404).send('Сотрудник не найден.');
    }

    if (validationError) {
        await discardUploadedAvatar(req.file);
        saveFormError(req, validationError, values);
        return res.redirect(`/user/${employeeId}/edit`);
    }

    let connection = null;
    let transactionStarted = false;
    let committed = false;

    try {
        const passwordHash = password
            ? await bcrypt.hash(password, 10)
            : null;

        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const [[employee]] = await connection.execute(
            `
            SELECT id, login, role, status, avatar
            FROM user
            WHERE id = ?
              AND company_id = ?
            LIMIT 1
            FOR UPDATE
            `,
            [
                employeeId,
                companyId
            ]
        );

        if (!employee) {
            throw new EmployeeEditError(
                'Сотрудник не найден.'
            );
        }

        if (
            employeeId === Number(req.session.user.id)
            && values.role !== employee.role
        ) {
            throw new EmployeeEditError(
                'Нельзя изменить собственную роль.'
            );
        }

        const [[loginOwner]] = await connection.execute(
            `
            SELECT id
            FROM user
            WHERE login = ?
              AND id <> ?
            LIMIT 1
            `,
            [
                values.login,
                employeeId
            ]
        );

        if (loginOwner) {
            throw new EmployeeEditError(
                'Этот логин уже используется.'
            );
        }

        if (
            employee.role === 'admin'
            && employee.status === 'active'
            && values.role !== 'admin'
        ) {
            const [companyAdmins] = await connection.execute(
                `
                SELECT id
                FROM user
                WHERE company_id = ?
                  AND role = 'admin'
                  AND status = 'active'
                FOR UPDATE
                `,
                [companyId]
            );

            if (companyAdmins.length <= 1) {
                throw new EmployeeEditError(
                    'Нельзя изменить роль последнего администратора.'
                );
            }
        }

        const storePlaceholders = values.store_ids
            .map(() => '?')
            .join(', ');
        const [selectedStores] = await connection.execute(
            `
            SELECT id
            FROM stores
            WHERE company_id = ?
              AND status = 'active'
              AND id IN (${storePlaceholders})
            FOR UPDATE
            `,
            [
                companyId,
                ...values.store_ids
            ]
        );

        if (
            selectedStores.length
            !== values.store_ids.length
        ) {
            throw new EmployeeEditError(
                'Один из выбранных магазинов неактивен или недоступен.'
            );
        }

        const updateFields = [
            'login = ?',
            'name = ?',
            'role = ?',
            'email = ?',
            'phone = ?',
            'notes = ?',
            'salary = ?',
            'hire_date = ?',
            'birth_date = ?',
            'position = ?'
        ];
        const updateParams = [
            values.login,
            values.name,
            values.role,
            values.email || null,
            values.phone || null,
            values.notes || null,
            values.salary
                ? Number(values.salary)
                : null,
            values.hire_date || null,
            values.birth_date || null,
            values.position || null
        ];
        const avatar = req.file
            ? `/uploads/avatars/${req.file.filename}`
            : employee.avatar;

        if (passwordHash) {
            updateFields.push('password = ?');
            updateParams.push(passwordHash);
        }

        if (req.file) {
            updateFields.push('avatar = ?');
            updateParams.push(avatar);
        }

        updateParams.push(
            employeeId,
            companyId
        );

        await connection.execute(
            `
            UPDATE user
            SET ${updateFields.join(', ')}
            WHERE id = ?
              AND company_id = ?
            LIMIT 1
            `,
            updateParams
        );

        await connection.execute(
            `
            DELETE us
            FROM user_stores us
            INNER JOIN stores s
                ON s.id = us.store_id
            WHERE us.user_id = ?
              AND s.company_id = ?
              AND s.status = 'active'
            `,
            [
                employeeId,
                companyId
            ]
        );

        for (const storeId of values.store_ids) {
            await connection.execute(
                `
                INSERT INTO user_stores
                    (user_id, store_id)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE
                    store_id = VALUES(store_id)
                `,
                [
                    employeeId,
                    storeId
                ]
            );
        }

        await connection.commit();
        transactionStarted = false;
        committed = true;

        if (employeeId === Number(req.session.user.id)) {
            Object.assign(req.session.user, {
                name: values.name,
                login: values.login,
                role: values.role,
                avatar,
                phone: values.phone || null
            });
        }

        req.session.userSuccess =
            'Данные сотрудника сохранены.';

        return res.redirect(`/user/${employeeId}`);
    } catch (error) {
        if (transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    'Не удалось откатить редактирование сотрудника:',
                    rollbackError
                );
            }
        }

        if (!committed) {
            await discardUploadedAvatar(req.file);
        }

        console.error(
            'Ошибка редактирования сотрудника:',
            error
        );

        const message = error instanceof EmployeeEditError
            ? error.message
            : error.code === 'ER_DUP_ENTRY'
                ? 'Этот логин уже используется.'
                : 'Не удалось сохранить сотрудника.';

        saveFormError(req, message, values);
        return res.redirect(`/user/${employeeId}/edit`);
    } finally {
        connection?.release();
    }
};
