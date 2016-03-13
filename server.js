'use strict'
const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const faker = require('faker')
const jwt = require('jsonwebtoken')
const Serializer = require('jsonapi-serializer').Serializer
const jsonApiErrors = require('jsonapi-errors')
const {
  BadRequestError,
  DbError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError
} = require('jsonapi-errors/lib/errors')

const config = require('./config')
const Account = require('./app/models/account')
const User = require('./app/models/user')

const app = express()
app.set('jwtSecret', config.secret)
const port = process.env.PORT || 8080

mongoose.connect(config.database)

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

const apiRouter = express.Router()

/**
 * not JSON-API routes
 */
app.get('/', function(req, res, next) {
  res.send('Welcome')
})
app.get('/setup', function(req, res, next) {
  const rndName = faker.name.firstName
  const rndNumber = faker.random.number

  const usersData = [
    { name: rndName(), role: 'user', password: rndNumber().toString() },
    { name: rndName(), role: 'user', password: rndNumber().toString() },
    { name: rndName(), role: 'user', password: rndNumber().toString() },
    { name: rndName(), role: 'admin', password: rndNumber().toString() },
    { name: rndName(), role: 'admin', password: rndNumber().toString() },
    { name: rndName(), role: 'admin', password: rndNumber().toString() }
  ]

  const promises = usersData.map((userData) => User(userData).save())

  Promise.all(promises)
  .then(() => res.send('Users added'))
  .catch((err) => res.send(err))
})

/**
 * JSON-API routes
 */
// users
apiRouter.get('/users', function(req, res, next) {
  const fields = 'name role'
  User.find({}, fields)
  .then((users) => {
    res.json(
      new Serializer('user', { attributes: fields.split(' ') }).serialize(users)
    )
  })
  .catch((err) => next(err))
})

function generateToken(data) {
  return jwt.sign(data, app.get('jwtSecret'), { expiresIn: 60 * 60 * 12}) // 12h
}

// authenticate
apiRouter.post('/auth', function(req, res, next) {
  const id = req.body.id
  const sentPassword = req.body.password

  if (!id || !sentPassword) return next(new BadRequestError('submit id and password'))

  User.findById(id)
  .then((user) => {
    if (!user) return next(new NotFoundError('user doesn\'t exist'))

    if (user.password !== sentPassword) {
      return next(new UnauthorizedError('wrong password'))
    }

    const tokenData = {
      id: user.id,
      name: user.name,
      role: user.role
    }
    res.status(201).json({ token: generateToken(tokenData) })
  })
  .catch((err) => next(err))
})

function getToken(req) {
  // header "Authorization": "Bearer <token>"
  const header = req.headers.authorization || ''
  return header.split('Bearer ')[1]
}

// token validation middleware
apiRouter.use(function(req, res, next) {
  const tokenSent = getToken(req)

  if (!tokenSent) return next(new UnauthorizedError('No token provided'))

  jwt.verify(tokenSent, app.get('jwtSecret'), function(err, decoded) {
    if (err) return next(new UnauthorizedError('Failed to authenticate token'))

    req.user = decoded
    next()
  })
})

// admin's authorization middleware
function onlyAdmins(req, res, next) {
  if (req.user && req.user.role && req.user.role === 'admin') {
    next()
  } else {
    next(new ForbiddenError('Insufficient access rights'))
  }
}

/**
 * Protected routes
 */
// accounts
apiRouter.route('/accounts')

  .post(onlyAdmins, function(req, res, next) {
    Account({ name: req.body.name }).save()
    .then(() => res.json({ message: 'Account created' }))
    .catch((err) => next(err))
  })

  .get(function(req, res, next) {
    Account.find()
    .then((accounts) => {
      res.json(
        new Serializer('account', { attributes: ['name'] }).serialize(accounts)
      )
    })
    .catch((err) => next(err))
  })


apiRouter.route('/accounts/:account_id')

  .get(function(req, res, next) {
    Account.findById(req.params.account_id)
    .then((account) => {
      res.json(
        new Serializer('account', { attributes: ['name'] }).serialize(account)
      )
    })
    .catch((err) => next(err))
  })

  .put(onlyAdmins, function(req, res, next) {
    const id = req.params.account_id
    const sentAccount = req.body

    Account.findByIdAndUpdate(id, { name: sentAccount.name })
    .then(() => res.json({ message: 'Account updated' }))
    .catch((err) => next(err))
  })

  .delete(onlyAdmins, function(req, res, next) {
    Account.findByIdAndRemove(req.params.account_id)
    .then(() => res.json({ message: 'Successfully deleted' }))
    .catch((err) => next(err))
  })


app.use('/api', apiRouter)

app.use(jsonApiErrors)

app.listen(port, function() {
  console.log('Listening on ', port)
})
