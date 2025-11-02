/**
 * 입력 큐 시스템
 * 입력 이벤트를 시간과 함께 저장하여 서로 다른 환경에서도 동일한 움직임을 재현합니다.
 */

export type InputAction =
  | "forward"
  | "backward"
  | "turnLeft"
  | "turnRight"
  | "jump";

export interface InputEvent {
  action: InputAction;
  pressed: boolean; // true: 키 누름, false: 키 떼기
  timestamp: number; // 이벤트 발생 시간 (performance.now())
  frame?: number; // 옵션: 프레임 번호 (순서 보장용)
}

/**
 * 입력 큐 클래스
 * 입력 이벤트를 시간 순서대로 저장하고 관리합니다.
 */
export class InputQueue {
  private queue: InputEvent[] = [];
  private currentInputs: Set<InputAction> = new Set();
  private gameStartTime: number = 0;
  private frameCounter: number = 0;

  /**
   * 게임 시작 시점을 설정합니다.
   */
  setGameStartTime(time: number = performance.now()) {
    this.gameStartTime = time;
    this.frameCounter = 0;
  }

  /**
   * 입력 이벤트를 큐에 추가합니다.
   */
  addInput(action: InputAction, pressed: boolean) {
    const event: InputEvent = {
      action,
      pressed,
      timestamp: performance.now(),
      frame: this.frameCounter++,
    };

    // 시간 순서대로 삽입 (이진 탐색으로 최적화)
    const insertIndex = this.findInsertIndex(event.timestamp);
    this.queue.splice(insertIndex, 0, event);

    // 현재 입력 상태 업데이트
    if (pressed) {
      this.currentInputs.add(action);
    } else {
      this.currentInputs.delete(action);
    }

    // 큐 크기 제한 (메모리 관리)
    if (this.queue.length > 1000) {
      this.queue.shift(); // 오래된 이벤트 제거
    }
  }

  /**
   * 타임스탬프를 기준으로 올바른 삽입 위치를 찾습니다.
   */
  private findInsertIndex(timestamp: number): number {
    let left = 0;
    let right = this.queue.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.queue[mid].timestamp < timestamp) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left;
  }

  /**
   * 특정 시간까지의 입력 이벤트를 가져옵니다.
   * @param currentTime 현재 게임 시간
   * @returns 처리해야 할 입력 이벤트 배열
   */
  getInputsUntil(currentTime: number): InputEvent[] {
    const gameTime = currentTime - this.gameStartTime;
    return this.queue.filter((event) => {
      const eventGameTime = event.timestamp - this.gameStartTime;
      return eventGameTime <= gameTime;
    });
  }

  /**
   * 특정 시간까지의 입력 이벤트를 처리하고 큐에서 제거합니다.
   * @param currentTime 현재 게임 시간
   * @returns 처리해야 할 입력 이벤트 배열
   */
  consumeInputsUntil(currentTime: number): InputEvent[] {
    const gameTime = currentTime - this.gameStartTime;
    const processed: InputEvent[] = [];
    const remaining: InputEvent[] = [];

    for (const event of this.queue) {
      const eventGameTime = event.timestamp - this.gameStartTime;
      if (eventGameTime <= gameTime) {
        processed.push(event);
      } else {
        remaining.push(event);
      }
    }

    this.queue = remaining;
    return processed;
  }

  /**
   * 현재 활성화된 입력을 반환합니다.
   */
  getCurrentInputs(): Set<InputAction> {
    return new Set(this.currentInputs);
  }

  /**
   * 특정 시점의 활성 입력을 재구성합니다.
   * @param gameTime 게임 시간 (게임 시작 후 경과 시간, 초 단위)
   */
  getActiveInputsAt(gameTime: number): Set<InputAction> {
    const activeInputs = new Set<InputAction>();
    // gameTime은 초 단위, timestamp는 밀리초 단위이므로 변환 필요
    const targetTime = this.gameStartTime + gameTime * 1000;

    for (const event of this.queue) {
      if (event.timestamp > targetTime) break;

      if (event.pressed) {
        activeInputs.add(event.action);
      } else {
        activeInputs.delete(event.action);
      }
    }

    return activeInputs;
  }

  /**
   * 큐의 게임 시작 시간을 가져옵니다 (디버그용이지만 외부 접근 필요)
   */
  getGameStartTime(): number {
    return this.gameStartTime;
  }

  /**
   * 큐를 비웁니다.
   */
  clear() {
    this.queue = [];
    this.currentInputs.clear();
  }

  /**
   * 큐 상태를 반환합니다 (디버그용).
   */
  getQueueState() {
    return {
      queueLength: this.queue.length,
      currentInputs: Array.from(this.currentInputs),
      gameStartTime: this.gameStartTime,
      frameCounter: this.frameCounter,
    };
  }

  /**
   * 입력 큐를 직렬화합니다 (네트워크 전송 또는 저장용).
   */
  serialize(): string {
    return JSON.stringify({
      queue: this.queue,
      gameStartTime: this.gameStartTime,
      frameCounter: this.frameCounter,
    });
  }

  /**
   * 직렬화된 데이터로부터 입력 큐를 복원합니다.
   */
  deserialize(data: string) {
    const parsed = JSON.parse(data);
    this.queue = parsed.queue;
    this.gameStartTime = parsed.gameStartTime;
    this.frameCounter = parsed.frameCounter || 0;

    // 현재 입력 상태 재구성
    this.currentInputs.clear();
    for (const event of this.queue) {
      if (event.pressed) {
        this.currentInputs.add(event.action);
      } else {
        this.currentInputs.delete(event.action);
      }
    }
  }
}
