'use strict'
const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')

const config = require('./config')
const Account = require('./app/models/account')

const app = express()
const port = process.env.PORT || 8080

mongoose.connect(config.database)

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

const router = express.Router()

router.get('/', function(req, res) {
  res.json({ message: 'welcome' })
})

// accounts
router.route('/accounts')

  .post(function(req, res) {
    Account({ name: req.body.name }).save()
    .then(() => res.json({ message: 'Account created' }))
    .catch((err) => res.json(err))
  })

  .get(function(req, res) {
    Account.find()
    .then((accounts) => res.json(accounts))
    .catch((err) => res.json(err))
  })


router.route('/accounts/:account_id')

  .get(function(req, res) {
    Account.findById(req.params.account_id)
    .then((account) => res.json(account))
    .catch((err) => res.json(err))
  })

  .put(function(req, res) {
    const id = req.params.account_id
    const sentAccount = req.body

    Account.findByIdAndUpdate(id, { name: sentAccount.name })
    .then(() => res.json({ message: 'Account updated' }))
    .catch((err) => res.json(err))
  })

  .delete(function(req, res) {
    Account.findByIdAndRemove(req.params.account_id)
    .then(() => res.json({ message: 'Successfully deleted' }))
    .catch((err) => res.json(err))
  })


app.use('/api', router)

app.listen(port, function() {
  console.log('Listening on ', port)
})
