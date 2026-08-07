import AsyncStorage from '@react-native-async-storage/async-storage';
import { MotionEvent } from '../types';
import { STORAGE_KEYS } from '../utils/constants';

const MAX_EVENTS = 1000;

/**
 * Adds an event to the log.
 */
export const addEvent = async (event: MotionEvent): Promise<void> => {
  try {
    const events = await getEvents();
    events.unshift(event);
    
    if (events.length > MAX_EVENTS) {
      events.length = MAX_EVENTS;
    }
    
    await AsyncStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
  } catch (error) {
    console.error('Failed to add event', error);
  }
};

/**
 * Gets events sorted by timestamp descending.
 */
export const getEvents = async (limit?: number): Promise<MotionEvent[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.EVENTS);
    if (!data) return [];
    
    let events: MotionEvent[] = JSON.parse(data);
    events.sort((a, b) => b.timestamp - a.timestamp);
    
    if (limit && limit > 0) {
      events = events.slice(0, limit);
    }
    
    return events;
  } catch (error) {
    console.error('Failed to get events', error);
    return [];
  }
};

/**
 * Gets events filtered by specific date.
 */
export const getEventsByDate = async (date: string): Promise<MotionEvent[]> => {
  try {
    const events = await getEvents();
    return events.filter(e => new Date(e.timestamp).toDateString() === new Date(date).toDateString());
  } catch (error) {
    console.error('Failed to get events by date', error);
    return [];
  }
};

/**
 * Updates a specific event.
 */
export const updateEvent = async (id: string, updates: Partial<MotionEvent>): Promise<void> => {
  try {
    const events = await getEvents();
    const index = events.findIndex(e => e.id === id);
    if (index !== -1) {
      events[index] = { ...events[index], ...updates };
      await AsyncStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    }
  } catch (error) {
    console.error('Failed to update event', error);
  }
};

/**
 * Clears all events.
 */
export const clearEvents = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.EVENTS);
  } catch (error) {
    console.error('Failed to clear events', error);
  }
};

/**
 * Gets total event count.
 */
export const getEventCount = async (): Promise<number> => {
  try {
    const events = await getEvents();
    return events.length;
  } catch (error) {
    console.error('Failed to get event count', error);
    return 0;
  }
};
