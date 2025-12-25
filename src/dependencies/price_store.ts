import { Db } from 'mongodb';
import { stringifyTokenClass } from '../types/type_helpers.js';
import { ITokenClassKey } from '../types/types.js';

interface IPriceHistory {
  timeRecorded: Date;
  tokenClass: ITokenClassKey;
  stringifiedTokenClass: string;
  price: number;
}

export class MongoPriceStore {
  constructor(private readonly db: Db) {}

  get collection() {
    return this.db.collection<Readonly<IPriceHistory>>('price_history');
  }

  init() {
    return this.collection.createIndex({
      stringifiedTokenClass: 1,
      timeRecorded: 1,
    });
  }

  async addPrices(
    prices: Array<Omit<IPriceHistory, 'timeRecorded' | 'stringifiedTokenClass'>>,
    timeRecorded: Date,
  ) {
    const resultData = prices.map((price) => ({
      ...price,
      timeRecorded,
      stringifiedTokenClass: stringifyTokenClass(price.tokenClass),
    }));

    // Guard clause: MongoDB does not allow insertMany on empty arrays
    if (resultData && resultData.length > 0) {
      await this.collection.insertMany(resultData);
    }
    // If empty, skip database update (no error thrown)
  }

  async getPriceChangePercent(
    tokenClass: Readonly<ITokenClassKey>,
    since: Readonly<Date>,
    until: Readonly<Date>,
  ) {
    const results = await this.collection
      .aggregate([
        {
          $match: {
            stringifiedTokenClass: stringifyTokenClass(tokenClass),
            timeRecorded: { $gte: since, $lte: until },
          },
        },
        {
          $group: {
            _id: null,
            maxPrice: { $max: '$price' },
            minPrice: { $min: '$price' },
          },
        },
      ])
      .toArray();

    const result = results[0];

    if (!result) {
      return undefined;
    }

    const change = Math.abs(result.maxPrice - result.minPrice);
    return change / result.minPrice;
  }
}
