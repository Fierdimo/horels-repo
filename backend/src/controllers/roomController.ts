import { Request, Response } from 'express';
import Room from '../models/room';

const roomController = {
  async getAllRooms(req: Request, res: Response) {
    try {
      const rooms = await Room.findAll();
      res.json(rooms);
    } catch (err) {
      res.status(500).json({ error: 'Error fetching rooms' });
    }
  },


  async createRoom(req: Request, res: Response) {
    try {
      const { name, description, capacity, type, floor, status, amenities, basePrice } = req.body;
      const room = await Room.create({ name, description, capacity, type, floor, status, amenities, basePrice });
      res.status(201).json(room);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error creando habitación' });
    }
  },



  async updateRoom(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, description, capacity, type, floor, status, amenities, basePrice } = req.body;
      const room = await Room.findByPk(id);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      await room.update({ name, description, capacity, type, floor, status, amenities, basePrice });
      res.json(room);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating room' });
    }
  },

  async deleteRoom(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const room = await Room.findByPk(id);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      await room.destroy();
      res.status(204).send();
    } catch (err) {
      res.status(400).json({ error: 'Error deleting room' });
    }
  },
};

export default roomController;
