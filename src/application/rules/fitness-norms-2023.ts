// Norms for the home-testable items of 国民体质测定标准（2023 年修订）, 国家国民体质监测中心.
// Source: 成年人部分 表 2-16 – 2-23 (printed pp. 43–46, 20–59 岁) and 老年人部分 表 3-13 – 3-18 (printed pp. 64–66, 60–79 岁).
// Only the 60-score lower bound and 70-score upper bound are kept per sex and 5-year group: the
// "mid band" that body-age estimation treats as the group's average level (UIUX20261008 V9.14).
// The elderly tables have no push-up or sit-up; the adult tables have no 30-second chair stand.
import type { FitnessTestItem } from '../../domain/plan-upgrade';

export interface NormBand {
  /** First age of the 5-year group. */
  fromAge: number;
  /** Lower bound of the 60-score row and upper bound of the 70-score row, in the item's unit. */
  mid: readonly [low: number, high: number];
}
type NormTable = Readonly<Partial<Record<FitnessTestItem, readonly NormBand[]>>>;

const ADULT_AGES = [20, 25, 30, 35, 40, 45, 50, 55] as const;
const OLDER_AGES = [60, 65, 70, 75] as const;
const bands = (ages: readonly number[], low: readonly number[], high: readonly number[]): NormBand[] =>
  ages.map((fromAge, index) => ({ fromAge, mid: [low[index]!, high[index]!] as const }));

export const FITNESS_NORMS_2023: Readonly<Record<'male' | 'female', NormTable>> = {
  male: {
    // 表 2-16 男性成年人俯卧撑（次）
    pushup: bands(ADULT_AGES, [15, 14, 13, 13, 12, 11, 9, 8], [22, 21, 20, 19, 18, 16, 14, 13]),
    // 表 2-18 男性成年人 1 分钟仰卧起坐（次/分）
    situp60s: bands(ADULT_AGES, [21, 20, 19, 18, 16, 15, 13, 11], [27, 25, 24, 23, 21, 19, 17, 15]),
    // 表 2-20 男性成年人坐位体前屈（厘米）+ 表 3-13 男性老年人坐位体前屈
    sitAndReachCm: [
      ...bands(ADULT_AGES, [2.3, 0.9, 0.0, -0.2, -0.2, -0.3, -0.8, -1.7], [8.3, 6.9, 6.1, 5.8, 5.8, 5.7, 5.2, 4.3]),
      ...bands(OLDER_AGES, [-2.7, -3.6, -4.7, -5.6], [3.3, 2.4, 1.4, 0.4]),
    ],
    // 表 2-22 男性成年人闭眼单脚站立（秒）+ 表 3-17 男性老年人闭眼单脚站立
    singleLegStandEyesClosedS: [
      ...bands(ADULT_AGES, [12, 11, 11, 10, 9, 8, 7, 7], [23, 21, 20, 18, 16, 14, 12, 10]),
      ...bands(OLDER_AGES, [6, 5, 5, 4], [8, 7, 7, 6]),
    ],
    // 表 3-15 男性老年人 30 秒坐站（次）
    chairStand30s: bands(OLDER_AGES, [9, 9, 8, 8], [11, 11, 10, 10]),
  },
  female: {
    // 表 2-17 女性成年人跪卧撑（次）
    pushup: bands(ADULT_AGES, [11, 11, 11, 11, 10, 10, 9, 8], [18, 17, 17, 17, 17, 16, 15, 13]),
    // 表 2-19 女性成年人 1 分钟仰卧起坐（次/分）
    situp60s: bands(ADULT_AGES, [17, 15, 13, 13, 12, 10, 8, 7], [22, 20, 18, 18, 17, 15, 13, 11]),
    // 表 2-21 女性成年人坐位体前屈（厘米）+ 表 3-14 女性老年人坐位体前屈
    sitAndReachCm: [
      ...bands(ADULT_AGES, [6.4, 5.2, 4.3, 3.8, 3.8, 3.8, 3.9, 3.7], [12.1, 11.0, 10.0, 9.5, 9.6, 9.7, 9.8, 9.7]),
      ...bands(OLDER_AGES, [2.9, 2.0, 0.4, -1.5], [9.0, 8.1, 6.5, 4.5]),
    ],
    // 表 2-23 女性成年人闭眼单脚站立（秒）+ 表 3-18 女性老年人闭眼单脚站立
    singleLegStandEyesClosedS: [
      ...bands(ADULT_AGES, [13, 13, 12, 11, 10, 9, 8, 6], [25, 24, 22, 20, 19, 16, 13, 10]),
      ...bands(OLDER_AGES, [6, 6, 6, 5], [8, 8, 8, 7]),
    ],
    // 表 3-16 女性老年人 30 秒坐站（次）
    chairStand30s: bands(OLDER_AGES, [9, 8, 8, 7], [11, 10, 10, 9]),
  },
};

/** Middle age of a 5-year group (20–24 → 22). */
export const bandMiddleAge = (band: NormBand): number => band.fromAge + 2;
