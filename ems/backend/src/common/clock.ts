import { Global, Injectable, Module } from '@nestjs/common';

/**
 * The current time, as one injectable. Attendance rules depend on "now" (late after 09:15, which day
 * it is in Dhaka), so tests replace this with a clock they set.
 */
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}

/** A clock tests can move. */
export class FixedClock extends Clock {
  constructor(private current: Date) {
    super();
  }

  override now(): Date {
    return new Date(this.current);
  }

  set(value: Date | string): void {
    this.current = new Date(value);
  }
}

@Global()
@Module({ providers: [Clock], exports: [Clock] })
export class ClockModule {}
