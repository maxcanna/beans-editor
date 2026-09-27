/**
 * The smallest protobuf writer that covers Beanconqueror's BeanProto
 * (src/classes/bean/bean.proto in graphefruit/Beanconqueror): varints,
 * doubles, strings and nested messages. DOM-free, so the service worker can use it.
 */
export class ProtoWriter {
  #bytes: number[] = [];

  #varint(value: number) {
    let v = value;
    while (v > 0x7f) {
      this.#bytes.push((v % 0x80) | 0x80);
      v = Math.floor(v / 0x80);
    }
    this.#bytes.push(v);
  }

  #tag(field: number, wireType: 0 | 1 | 2) {
    this.#varint(field * 8 + wireType);
  }

  #lengthDelimited(field: number, bytes: Uint8Array | readonly number[]) {
    this.#tag(field, 2);
    this.#varint(bytes.length);
    for (const b of bytes) this.#bytes.push(b);
  }

  uint(field: number, value: number): this {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new RangeError(`Field ${field}: ${value} is not a uint`);
    this.#tag(field, 0);
    this.#varint(value);
    return this;
  }

  bool(field: number, value: boolean): this {
    return this.uint(field, value ? 1 : 0);
  }

  double(field: number, value: number): this {
    this.#tag(field, 1);
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value, true);
    for (let i = 0; i < 8; i++) this.#bytes.push(view.getUint8(i));
    return this;
  }

  string(field: number, value: string): this {
    this.#lengthDelimited(field, new TextEncoder().encode(value));
    return this;
  }

  message(field: number, inner: ProtoWriter): this {
    this.#lengthDelimited(field, inner.finish());
    return this;
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.#bytes);
  }
}
