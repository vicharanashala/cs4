let _io = null;
const onlineUsers = new Map(); // userId (string) -> socketId

const setIo = (io) => { _io = io; };
const getIo = () => _io;

const emitToUser = (userId, event, data) => {
  if (_io) _io.to(`user:${userId.toString()}`).emit(event, data);
};

module.exports = { setIo, getIo, onlineUsers, emitToUser };
