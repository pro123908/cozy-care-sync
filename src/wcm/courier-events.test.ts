import { describe, expect, it } from "vitest";
import { describeCourierEvent } from "./courier-events";

// Every string below is a real status from production courier_bookings.status_history.
describe("describeCourierEvent — PostEx", () => {
  it("explains an incomplete-address attempt and offers the address action", () => {
    const v = describeCourierEvent("Attempt Made: ICA(INCOMPLETE ADDRESS)");
    expect(v).toMatchObject({ title: "Delivery attempted", kind: "attempt", action: "address" });
    expect(v.detail).toMatch(/address/i);
  });

  it("maps customer-not-available and refused attempts", () => {
    expect(describeCourierEvent("Attempt Made: CNA(CUSTOMER NOT AVAILABLE)")).toMatchObject({
      kind: "attempt",
      action: "availability",
    });
    expect(describeCourierEvent("Attempt Made: RFD(REFUSED TO RECEIVE)")).toMatchObject({
      kind: "attempt",
      action: "contact",
    });
  });

  it("falls back to the 3-letter code when the reason text is missing or repeats the code", () => {
    expect(describeCourierEvent("Attempt Made: RFD")).toMatchObject({ action: "contact" });
    expect(describeCourierEvent("Attempt Made: ICA")).toMatchObject({ action: "address" });
    expect(describeCourierEvent("Attempt Made: CNA(CNA)")).toMatchObject({
      action: "availability",
    });
    expect(describeCourierEvent("Attempt Made:")).toMatchObject({
      kind: "attempt",
      action: "contact",
    });
  });

  it("treats a hold on consignee request as a hold, not a failure", () => {
    expect(describeCourierEvent("Attempt Made: HCR(HOLD ON CONSIGNEE REQUEST)")).toMatchObject({
      kind: "hold",
      action: "availability",
    });
  });

  it("covers the normal journey", () => {
    expect(describeCourierEvent("Delivered to Customer").kind).toBe("delivered");
    expect(describeCourierEvent("Enroute for Delivery").title).toBe("Out for delivery");
    expect(describeCourierEvent("Waiting for Delivery").title).toBe("Ready for delivery");
    expect(describeCourierEvent("Departed to PostEx. Warehouse").title).toBe(
      "Picked up by the courier",
    );
    expect(describeCourierEvent("At Wellcaremart.pk Warehouse").title).toBe(
      "Packed and ready for pickup",
    );
    expect(describeCourierEvent("Received at KHI Warehouse").title).toBe(
      "Received at the courier's warehouse",
    );
    expect(describeCourierEvent("Delivery Under Review")).toMatchObject({ kind: "hold" });
  });

  it("translates hub codes it knows and hides the ones it doesn't", () => {
    expect(describeCourierEvent("Arrived at Transit Hub LHE").title).toBe(
      "Arrived at the Lahore hub",
    );
    expect(describeCourierEvent("Arrived at Transit Hub JCB").title).toBe(
      "Arrived at a transit hub",
    );
    expect(describeCourierEvent("Departed to RAHIMYAR KHAN").title).toBe(
      "On the way to Rahimyar Khan",
    );
  });

  it("marks returns and cancellations", () => {
    for (const s of [
      "Waiting for Return",
      "Return Process Initiated",
      "Return to KARACHI",
      "En Route to Merchant Warehouse",
      "Merchant Request for Return",
    ]) {
      expect(describeCourierEvent(s).kind).toBe("return");
    }
    expect(describeCourierEvent("Returned at Merchant Warehouse").title).toBe("Returned to us");
    expect(describeCourierEvent("Booking Cancelled by Merchant").kind).toBe("cancelled");
  });
});

describe("describeCourierEvent — Leopards", () => {
  it("covers the normal journey, including blank city names", () => {
    expect(describeCourierEvent("Shipment picked in  KHI MAIN OFFICE")).toMatchObject({
      title: "Picked up by the courier",
      detail: "Karachi Main Office",
    });
    expect(describeCourierEvent("Dispatched to TCP HUB").title).toBe("On the way to TCP Hub");
    expect(describeCourierEvent("Dispatched to").title).toBe("On the way");
    expect(describeCourierEvent("Arrived at Station in SOHRAB GOTH").title).toBe(
      "Arrived at Sohrab Goth",
    );
    expect(describeCourierEvent("Arrived at Station in").title).toBe(
      "Arrived at a courier station",
    );
    expect(describeCourierEvent("Assigned to courier in KARACHI SOUTH D.H.A").title).toBe(
      "Assigned to a delivery rider",
    );
    expect(describeCourierEvent("Pending").title).toBe("Booked with the courier");
    expect(describeCourierEvent("Delivered").kind).toBe("delivered");
  });

  it("explains return events with the reason", () => {
    expect(describeCourierEvent("Ready for Return - CONSIGNEE REFUSED")).toMatchObject({
      kind: "return",
      detail: "Reason: Consignee Refused",
    });
    expect(describeCourierEvent("Return To Sender").kind).toBe("return");
    expect(describeCourierEvent("Return to Origin").kind).toBe("return");
  });
});

describe("describeCourierEvent — unknown wording", () => {
  it("shows the courier's own text instead of inventing one", () => {
    expect(describeCourierEvent("Parcel inspected by customs").title).toBe(
      "Parcel inspected by customs",
    );
    expect(describeCourierEvent("SOMETHING NEW HERE").title).toBe("Something New Here");
  });

  it("prefers statusWithCity when given (what the page used to show)", () => {
    expect(describeCourierEvent("Dispatched to", "Dispatched to KHI MAIN OFFICE").title).toBe(
      "On the way to Karachi Main Office",
    );
  });
});
