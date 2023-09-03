const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

io.on('connection', (socket) => {
    console.log('New WebSocket connection')

    socket.on('join', (options, callback) => {   // options > {username , room}
        const { error, user } = addUser({ id: socket.id, ...options })  //add user    

        if (error) {
            return callback(error)
        }
        //when join room
        socket.join(user.room)   // events of room > io.to().emit , socket.broadcast.to().emit

        socket.emit('message', generateMessage('Admin', 'Welcome!'))   // socket.emit('message' , {username :'admin' , message:'welcome' , createdAt : new Date().getTime() })
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`))  // send message to old user axcept new user
        io.to(user.room).emit('roomData', {     //get all users after user has joined
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id)  //get user
        const filter = new Filter()  // filter message

        if (filter.isProfane(message)) {   
            return callback('Profanity is not allowed!') // acknowledgements> message from server
        }

        io.to(user.room).emit('message', generateMessage(user.username, message))  // send message in room
        callback()       // acknowledgements
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)  //get user
        // send message in room
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)   //remove user
        //message to other users in room
        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`))
            //get all users after user has left
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

server.listen(port, () => {
    console.log(`Server is up on port ${port}!`)
})