// const express = require('express');
// const router = express.Router();

// const db = require('../config/db');
// const bcrypt = require('bcrypt');

// // Вход в аккаунт
// router.get('/login', (req, res) => {
//     if (req.session.user) {
//         return res.redirect('/dashboard');
//     }

//     const success = req.session.success;
//     req.session.success = null;

//     res.render('login', {
//         titleKey: 'title.login',
//         error: null,
//         success,
//         script: [
//             {
//                 src: 'login.js',
//             }
//         ],
//         style: [
//             {
//                 href: 'login.css',
//             }
//         ],
//     });

// });
// router.post('/login', async (req, res) => {

//     try {

//         const {
//             login,
//             password
//         } = req.body;

//         const [rows] =
//             await db.execute(
//                 `
//                 SELECT *
//                 FROM user
//                 WHERE login = ?
//                 `,
//                 [login]
//             );

        

//         if (!rows.length) {

//             return renderLogin(
//                 res,
//                 'Неверный логин или пароль'
//             );
//         }

//         const user =
//             rows[0];

        

//         const validPassword =
//             await bcrypt.compare(
//                 password,
//                 user.password
//             );

//         if (!validPassword) {

//             return renderLogin(
//                 res,
//                 'Неверный логин или пароль'
//             );

//         }


//         if (user.status === 'blocked') {

//             return renderLogin(
//                 res,
//                 'Ваш аккаунт заблокирован'
//             );

//         }

//         req.session.user = {

//             id: user.id,
//             name: user.name,
//             login: user.login,
//             role: user.role,
//             avatar: user.avatar,
//             status: user.status,
//             phone: user.phone,
//             store_id: user.store_id,
//             company_id: user.company_id


//         };
//         await db.query(
//             'UPDATE user SET last_login = NOW() WHERE id = ?',
//             [user.id]
//         );
//         res.redirect('/dashboard');

//     } catch (error) {

//         console.error(error);

//         res.send(
//             'Ошибка входа'
//         );

//     }

// });

// module.exports = router;

const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');

router.get('/login', authController.showLogin);
router.post('/login', authController.login);

router.get('/register', authController.showRegister);
router.post('/register', authController.register);

router.get('/logout', authController.logout);

module.exports = router;