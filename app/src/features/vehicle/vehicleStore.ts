import { create } from "zustand";

export type VehicleType = "car" | "bike" | "mono";
export type MotorType = "ev" | "ice"; // ev: 전기, ice: 내연

interface VehicleState {
  type: VehicleType;
  motorType: MotorType;
  setType: (type: VehicleType) => void;
  setMotorType: (motorType: MotorType) => void;
}

export const useVehicleStore = create<VehicleState>((set) => ({
  type: "car",
  motorType: "ev",
  setType: (type) => set({ type }),
  setMotorType: (motorType) => set({ motorType }),
}));
