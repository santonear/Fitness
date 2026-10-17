# Training engine V2 acceptance report

Functional correctness evidence. Timing is informational only; engine:perf reports three independent cold 80-profile runs separately.

```json
{
  "version": 3,
  "sourceHash": "3b6408926eb80c0b38acb2bc44c480b2516f60de6819cbce1c8e8bd551290aa3",
  "inputHash": "4afe1f2f716c5ecc3bd9e1672fc47a3a0ab85db15cf4ab4c7b33b13b908c2989",
  "seed": 20261015,
  "nodeVersion": "v24.14.0",
  "runtimeFingerprint": "670a0b0516d2baa29f38405873b784232e6c52e72a83907905cd2e2906ca7dc5",
  "wallMs": 169795.82690429688,
  "report": {
    "stage": "V2 diagnostic",
    "validationCoverage": "Current source-version hard rules audited; deferred rules and branches listed separately",
    "hardCoverageComplete": true,
    "seed": 20261015,
    "evaluated": 2000,
    "extremeEvaluated": 200,
    "weightedTotals": {
      "pass": 1608,
      "blocked": 392,
      "fail": 0,
      "environment_limited": 0,
      "environment_unavailable": 0
    },
    "extremeTotals": {
      "pass": 200,
      "blocked": 0,
      "fail": 0,
      "environment_limited": 0,
      "environment_unavailable": 0
    },
    "environmentLimited": {
      "weighted": 0,
      "extreme": 0,
      "weightedFraction": 0,
      "weightedLimit": 0.005,
      "withinWeightedLimit": true
    },
    "totals": {
      "pass": 1808,
      "blocked": 392,
      "fail": 0,
      "environment_limited": 0,
      "environment_unavailable": 0
    },
    "empty": 0,
    "unsafe": [],
    "environmentUnmet": [],
    "actionableHardViolations": [],
    "nondeterministic": [],
    "qualityEligible": 1608,
    "coverageEligible": 1591,
    "coverageEvaluated": 1591,
    "scoreUnmeasured": 0,
    "coverageMisses": [],
    "lowScoreCases": [
      {
        "index": 7,
        "score": 0.5712682379349046
      },
      {
        "index": 9,
        "score": 0.5888612726818135
      },
      {
        "index": 28,
        "score": 0.4578125
      },
      {
        "index": 42,
        "score": 0.5359154411764706
      },
      {
        "index": 50,
        "score": 0.5535103785103785
      },
      {
        "index": 62,
        "score": 0.45075000000000004
      },
      {
        "index": 70,
        "score": 0.4952489484448561
      },
      {
        "index": 125,
        "score": 0.5511113288052943
      },
      {
        "index": 128,
        "score": 0.4254166666666667
      },
      {
        "index": 134,
        "score": 0.3892241379310345
      },
      {
        "index": 140,
        "score": 0.5394188925570228
      },
      {
        "index": 145,
        "score": 0.513735632183908
      },
      {
        "index": 160,
        "score": 0.5833211143695015
      },
      {
        "index": 168,
        "score": 0.46680469289164944
      },
      {
        "index": 170,
        "score": 0.5842517921146954
      },
      {
        "index": 185,
        "score": 0.4541034691260891
      },
      {
        "index": 188,
        "score": 0.3786956521739131
      },
      {
        "index": 189,
        "score": 0
      },
      {
        "index": 235,
        "score": 0
      },
      {
        "index": 250,
        "score": 0.5252672899436653
      },
      {
        "index": 260,
        "score": 0.5812256543899703
      },
      {
        "index": 263,
        "score": 0.5996710894839592
      },
      {
        "index": 266,
        "score": 0.4982753357753357
      },
      {
        "index": 276,
        "score": 0.5024038461538461
      },
      {
        "index": 279,
        "score": 0.49328593195365344
      },
      {
        "index": 294,
        "score": 0.5262252944003016
      },
      {
        "index": 318,
        "score": 0.5822981366459627
      },
      {
        "index": 324,
        "score": 0.44824735449735453
      },
      {
        "index": 335,
        "score": 0.05555555555555555
      },
      {
        "index": 350,
        "score": 0.5225961538461538
      },
      {
        "index": 357,
        "score": 0.5480651340996169
      },
      {
        "index": 360,
        "score": 0.49768216717369257
      },
      {
        "index": 400,
        "score": 0.5433220582205822
      },
      {
        "index": 433,
        "score": 0.5199787007615269
      },
      {
        "index": 447,
        "score": 0.5430008210180625
      },
      {
        "index": 470,
        "score": 0.5483418367346939
      },
      {
        "index": 481,
        "score": 0.5809445179189896
      },
      {
        "index": 488,
        "score": 0.5814893892339544
      },
      {
        "index": 494,
        "score": 0.5486469277774467
      },
      {
        "index": 501,
        "score": 0.5694314449917898
      },
      {
        "index": 504,
        "score": 0.4684932296343032
      },
      {
        "index": 528,
        "score": 0.5083333333333333
      },
      {
        "index": 535,
        "score": 0.05555555555555555
      },
      {
        "index": 544,
        "score": 0.45958333333333334
      },
      {
        "index": 559,
        "score": 0.5365773809523808
      },
      {
        "index": 576,
        "score": 0.5372685185185185
      },
      {
        "index": 579,
        "score": 0.5338875205254515
      },
      {
        "index": 595,
        "score": 0.5978855815597465
      },
      {
        "index": 635,
        "score": 0
      },
      {
        "index": 640,
        "score": 0.5890603578642408
      },
      {
        "index": 652,
        "score": 0.5883652833163135
      },
      {
        "index": 655,
        "score": 0.5844155193411075
      },
      {
        "index": 656,
        "score": 0.5943386428221921
      },
      {
        "index": 660,
        "score": 0.4982753357753357
      },
      {
        "index": 664,
        "score": 0.5341756854256854
      },
      {
        "index": 673,
        "score": 0.5887757904863168
      },
      {
        "index": 689,
        "score": 0.5936590886098015
      },
      {
        "index": 698,
        "score": 0.5651041666666666
      },
      {
        "index": 705,
        "score": 0.5058703703703704
      },
      {
        "index": 714,
        "score": 0.49185210075667063
      },
      {
        "index": 724,
        "score": 0.5933083604693034
      },
      {
        "index": 735,
        "score": 0
      },
      {
        "index": 737,
        "score": 0.5465243568691844
      },
      {
        "index": 752,
        "score": 0.5923568992369956
      },
      {
        "index": 756,
        "score": 0.5708821329237729
      },
      {
        "index": 758,
        "score": 0.5929222470238096
      },
      {
        "index": 759,
        "score": 0.5362900152718475
      },
      {
        "index": 786,
        "score": 0.575199944842802
      },
      {
        "index": 789,
        "score": 0.5209166666666667
      },
      {
        "index": 791,
        "score": 0.4872844827586207
      },
      {
        "index": 826,
        "score": 0.583915770609319
      },
      {
        "index": 846,
        "score": 0.5026041666666666
      },
      {
        "index": 847,
        "score": 0.5752200888192267
      },
      {
        "index": 858,
        "score": 0.5841145833333333
      },
      {
        "index": 867,
        "score": 0.5782893826135105
      },
      {
        "index": 886,
        "score": 0.5673166100017215
      },
      {
        "index": 887,
        "score": 0.5994586891780488
      },
      {
        "index": 907,
        "score": 0.5762064146679532
      },
      {
        "index": 920,
        "score": 0.49768669940850113
      },
      {
        "index": 935,
        "score": 0.05555555555555555
      },
      {
        "index": 943,
        "score": 0.5915979938271606
      },
      {
        "index": 948,
        "score": 0.5928540785683643
      },
      {
        "index": 965,
        "score": 0.5972649489073463
      },
      {
        "index": 966,
        "score": 0.5896875
      },
      {
        "index": 993,
        "score": 0.5966192684955612
      },
      {
        "index": 994,
        "score": 0.5732393687193277
      },
      {
        "index": 1000,
        "score": 0.5804301075268817
      },
      {
        "index": 1061,
        "score": 0.5235245496913241
      },
      {
        "index": 1068,
        "score": 0.5614872685185185
      },
      {
        "index": 1100,
        "score": 0.5755434782608696
      },
      {
        "index": 1115,
        "score": 0.5959299917039478
      },
      {
        "index": 1120,
        "score": 0.5530838487972509
      },
      {
        "index": 1125,
        "score": 0.5572126436781609
      },
      {
        "index": 1135,
        "score": 0
      },
      {
        "index": 1146,
        "score": 0.5256540270429159
      },
      {
        "index": 1151,
        "score": 0.5714239282520603
      },
      {
        "index": 1154,
        "score": 0.5057407407407407
      },
      {
        "index": 1160,
        "score": 0.5974499950975586
      },
      {
        "index": 1166,
        "score": 0.5833333333333334
      },
      {
        "index": 1170,
        "score": 0.5783497896442692
      },
      {
        "index": 1176,
        "score": 0.5881485498558848
      },
      {
        "index": 1208,
        "score": 0.5198929398148148
      },
      {
        "index": 1216,
        "score": 0.5793842805939581
      },
      {
        "index": 1226,
        "score": 0.5871031746031746
      },
      {
        "index": 1234,
        "score": 0.5751913093992916
      },
      {
        "index": 1235,
        "score": 0
      },
      {
        "index": 1245,
        "score": 0.5924942765567766
      },
      {
        "index": 1255,
        "score": 0.5780595788945738
      },
      {
        "index": 1266,
        "score": 0.5875
      },
      {
        "index": 1295,
        "score": 0.5884099616858238
      },
      {
        "index": 1322,
        "score": 0.5669919163357201
      },
      {
        "index": 1335,
        "score": 0
      },
      {
        "index": 1371,
        "score": 0.45327380952380947
      },
      {
        "index": 1378,
        "score": 0.5056444444444445
      },
      {
        "index": 1379,
        "score": 0.4663269051698897
      },
      {
        "index": 1387,
        "score": 0.3826970443349753
      },
      {
        "index": 1400,
        "score": 0.5886768682399214
      },
      {
        "index": 1411,
        "score": 0.5890644102039259
      },
      {
        "index": 1435,
        "score": 0
      },
      {
        "index": 1454,
        "score": 0.5925511664005835
      },
      {
        "index": 1460,
        "score": 0.5445652173913043
      },
      {
        "index": 1478,
        "score": 0.5250793650793651
      },
      {
        "index": 1514,
        "score": 0.5957429185856661
      },
      {
        "index": 1522,
        "score": 0.5398809523809524
      },
      {
        "index": 1527,
        "score": 0.5625496031746031
      },
      {
        "index": 1535,
        "score": 0
      },
      {
        "index": 1554,
        "score": 0.003749999999999997
      },
      {
        "index": 1557,
        "score": 0.5759507275132275
      },
      {
        "index": 1560,
        "score": 0.5441086691086691
      },
      {
        "index": 1577,
        "score": 0.5770873015873016
      },
      {
        "index": 1589,
        "score": 0.5603951326751003
      },
      {
        "index": 1633,
        "score": 0.581962434664927
      },
      {
        "index": 1635,
        "score": 0.05555555555555555
      },
      {
        "index": 1638,
        "score": 0.576432022084196
      },
      {
        "index": 1674,
        "score": 0.4524156507707041
      },
      {
        "index": 1677,
        "score": 0.586871921182266
      },
      {
        "index": 1684,
        "score": 0.47074172915328283
      },
      {
        "index": 1708,
        "score": 0.5645238095238095
      },
      {
        "index": 1718,
        "score": 0.4855512224046707
      },
      {
        "index": 1770,
        "score": 0.5032260435038213
      },
      {
        "index": 1776,
        "score": 0.5313969017094018
      },
      {
        "index": 1784,
        "score": 0.5831330273839815
      },
      {
        "index": 1835,
        "score": 0.05555555555555555
      },
      {
        "index": 1840,
        "score": 0.5517620004873294
      },
      {
        "index": 1844,
        "score": 0.5933858166922683
      },
      {
        "index": 1846,
        "score": 0.5458921222810111
      },
      {
        "index": 1881,
        "score": 0
      },
      {
        "index": 1883,
        "score": 0.5735276415860708
      },
      {
        "index": 1895,
        "score": 0.44300646867824517
      },
      {
        "index": 1904,
        "score": 0.560984571247854
      },
      {
        "index": 1910,
        "score": 0.5730904055117273
      },
      {
        "index": 1917,
        "score": 0.5940062830687831
      },
      {
        "index": 1928,
        "score": 0.5628472222222222
      },
      {
        "index": 1935,
        "score": 0
      },
      {
        "index": 1936,
        "score": 0.5108539094650206
      },
      {
        "index": 1943,
        "score": 0.451675925925926
      },
      {
        "index": 1945,
        "score": 0.5902504730965501
      },
      {
        "index": 1960,
        "score": 0.5505915637860083
      },
      {
        "index": 1963,
        "score": 0.5802671254529096
      },
      {
        "index": 1994,
        "score": 0.5994574067476355
      }
    ],
    "qualityMedian": 0.7687400790072276,
    "qualityP10": 0.6001057335246478,
    "within10Rate": 0.9794776119402985,
    "timingBreakdown": {
      "originalEligible": 1608,
      "intentionalShort": 0,
      "nonShortEligible": 1608,
      "nonShortWithin10": 1575,
      "nonShortWithin10Rate": 0.9794776119402985,
      "shortageFraction": 0,
      "shortageFractionLimit": 0.05,
      "minimumDurationRatio": 0.9,
      "below50Count": 0,
      "shortageProfiles": [],
      "averageGapSeconds": 0,
      "maxGapSeconds": 0
    },
    "coverageRate": 1,
    "notices": {
      "engine.copy.target_volume": 1776,
      "engine.copy.target_aerobic": 1899,
      "session.copy.short_stretch_target": 748,
      "safety.copy.clearance_needed": 610,
      "safety.copy.age45_advisory": 350,
      "pregnancy.pelvic_floor.copy": 168,
      "pregnancy.stop.copy.stop": 117,
      "postpartum.copy.urgent.urgent": 151,
      "engine.copy.target_balance": 24,
      "postpartum.gate.pre_check.copy": 70,
      "safety.copy.illness_pause": 89,
      "postpartum.pelvic_floor.copy": 52,
      "postpartum.physio_offer.offer": 22
    },
    "noticeCounts": {
      "0": 0,
      "1": 16,
      "2": 449,
      "3": 1535
    },
    "extremeNoticeCounts": {
      "0": 0,
      "1": 0,
      "2": 43,
      "3": 157
    },
    "noticeOverflow": 0,
    "lowScoreLoss": [
      {
        "id": "goal.floor.all",
        "weightedLoss": 224.29777118513422
      },
      {
        "id": "dose.sets_week.intermediate",
        "weightedLoss": 209.6867424242424
      },
      {
        "id": "balance.week.hinge_knee",
        "weightedLoss": 163.7414238422642
      },
      {
        "id": "goal.aerobic.baseline",
        "weightedLoss": 159.08744444444443
      },
      {
        "id": "aerobic.target.weekly",
        "weightedLoss": 159.08744444444443
      },
      {
        "id": "dose.sets_week.beginner",
        "weightedLoss": 154.8472222222222
      },
      {
        "id": "session.warmup.general",
        "weightedLoss": 140.04203703703706
      },
      {
        "id": "dose.sets_week.goal_matrix",
        "weightedLoss": 120.09270833333335
      },
      {
        "id": "session.warmup.dynamic",
        "weightedLoss": 99.48962962962962
      },
      {
        "id": "goal.params.health",
        "weightedLoss": 77.95565096496034
      },
      {
        "id": "session.cooldown.stretch",
        "weightedLoss": 76.84738095238095
      },
      {
        "id": "week.frequency.per_muscle",
        "weightedLoss": 75
      },
      {
        "id": "duration.fit.tolerance",
        "weightedLoss": 69.82222222222222
      },
      {
        "id": "goal.params.muscle",
        "weightedLoss": 62.78405144988922
      },
      {
        "id": "goal.params.fat_loss",
        "weightedLoss": 52.19658051143062
      },
      {
        "id": "goal.params.mobility",
        "weightedLoss": 41.041278017289336
      },
      {
        "id": "select.unilateral.weekly",
        "weightedLoss": 35
      },
      {
        "id": "balance.week.core_three",
        "weightedLoss": 35
      },
      {
        "id": "caution.back.keep_active",
        "weightedLoss": 32.27455555555555
      },
      {
        "id": "goal.params.strength",
        "weightedLoss": 22.472414480742877
      },
      {
        "id": "older.week.flexibility",
        "weightedLoss": 16.75
      },
      {
        "id": "older.week.aerobic",
        "weightedLoss": 16.73777777777778
      },
      {
        "id": "goal.params.start_moving",
        "weightedLoss": 16.66451783701285
      },
      {
        "id": "session.warmup.balance_older",
        "weightedLoss": 15.958333333333332
      },
      {
        "id": "safety.session.warmup_cooldown",
        "weightedLoss": 13.41902777777778
      },
      {
        "id": "older.week.strength",
        "weightedLoss": 11.071428571428573
      },
      {
        "id": "postpartum.weekly_target",
        "weightedLoss": 9.938500000000001
      },
      {
        "id": "pregnancy.week.target",
        "weightedLoss": 8.590814814814816
      },
      {
        "id": "dose.sets_exercise",
        "weightedLoss": 7.127389827024642
      },
      {
        "id": "progression.new.weekly_sets",
        "weightedLoss": 6.927083333333333
      },
      {
        "id": "week.coverage.patterns",
        "weightedLoss": 2.666666666666665
      },
      {
        "id": "balance.week.pull_push",
        "weightedLoss": 1
      },
      {
        "id": "older.week.multicomponent",
        "weightedLoss": 0
      },
      {
        "id": "older.template.balance_required",
        "weightedLoss": 0
      }
    ],
    "topLoss": [
      {
        "id": "dose.sets_week.intermediate",
        "weightedLoss": 1179.5128624090794,
        "count": 754,
        "applicableCount": 816,
        "averageWeightedLoss": 1.4454814490307346
      },
      {
        "id": "goal.params.fat_loss",
        "weightedLoss": 377.07070971567475,
        "count": 284,
        "applicableCount": 284,
        "averageWeightedLoss": 1.3277137666044885
      },
      {
        "id": "goal.params.muscle",
        "weightedLoss": 362.5185433798157,
        "count": 283,
        "applicableCount": 283,
        "averageWeightedLoss": 1.280984252225497
      },
      {
        "id": "goal.params.health",
        "weightedLoss": 333.3497515836224,
        "count": 265,
        "applicableCount": 265,
        "averageWeightedLoss": 1.2579235908815938
      },
      {
        "id": "dose.sets_week.beginner",
        "weightedLoss": 895.6417347428882,
        "count": 715,
        "applicableCount": 778,
        "averageWeightedLoss": 1.1512104559677225
      },
      {
        "id": "goal.params.mobility",
        "weightedLoss": 254.10551621817712,
        "count": 249,
        "applicableCount": 249,
        "averageWeightedLoss": 1.0205040811974984
      },
      {
        "id": "session.warmup.balance_older",
        "weightedLoss": 228.66666666666666,
        "count": 229,
        "applicableCount": 229,
        "averageWeightedLoss": 0.9985443959243085
      },
      {
        "id": "older.week.flexibility",
        "weightedLoss": 237.99999999999983,
        "count": 242,
        "applicableCount": 242,
        "averageWeightedLoss": 0.9834710743801646
      },
      {
        "id": "goal.params.start_moving",
        "weightedLoss": 239.6075500691528,
        "count": 247,
        "applicableCount": 247,
        "averageWeightedLoss": 0.9700710529115498
      },
      {
        "id": "goal.aerobic.baseline",
        "weightedLoss": 1553.7268888888918,
        "count": 1608,
        "applicableCount": 1608,
        "averageWeightedLoss": 0.9662480652294103
      }
    ],
    "performance": {
      "totalMs": 169795.82690429688,
      "p95Ms": 523.8790000000008,
      "generationP95Ms": 523.8790000000008,
      "classificationP95Ms": 526.3190999999933,
      "parallelAuditWallMs": 168343.5999,
      "workerContentionP95Ms": 523.8790000000008
    }
  }
}
```

## 2026-10-18 补时顺序复修结果

- 只读诊断274个旧短课：A真耗尽0、B算法未补274；最低37.0833%，94个画像低于50%。按人群、水平、器械组合、目标时长的交叉表见 [补时容量诊断](short-capacity-diagnosis.md)。
- 按批准的四步补时顺序修复后，一次2,000真实分布合成画像＋200极端画像全量：硬违规0、空计划0、不确定性0，覆盖率100%；质量中位数0.768740、P10 0.600106。
- 原始±10%时长达标率97.947761%（1575/1608）；单列口径同为97.947761%。有意缩短0/2000（0%），A类原因分组为空，平均/最大缺口均0；目标课程最低实际/目标90%，低于50%数量0。专项来源规定“无目标时长”的产后阶段1单独保留，不伪造目标或强行补时。
- 固定80画像原始及单列达标率均100%，golden20/80/177问题画像均零硬违规、零空计划。有氧整条工作时长仍受600/300秒及专项更低上限约束，重复身份不得拆条。四个指定安全画像已有逐条和第3天回归；产后未许可只保留来源允许的低强度步行，不为多样性增加禁止动作。
- 完整验证耗时169.796秒（4个工作进程），本次并行观测生成P95 523.879毫秒；这不是三次冷启动P95中位数。两项高于原参考目标，据实保留为遗留问题，不为计时重跑或继续优化。
- 数据和训练历史未改写；无模型调用。最终测试、浏览器复测与预览部署结果在本节后追加，当前不能据此声明已部署。


## 孕期／老年实际入选的正冲击标注清单

对完整输入集中的孕期／老年画像重新只读提取实际动作，并单独核对全部200极端画像的最低时长；共生成660份，不另跑完整正确性评测。极端目标课程最低实际／目标为90.5%，低于50%的数量0。下表是目录 impact=1 的实际入选动作，不把它们称为零冲击；没有入选 running/jumping 标记或 impact≥2 的动作。动作名称不作为关节负担或医学适用性的证明。

|人群|动作|目录impact|画像数|
|---|---|---:|---:|
|老年|哑铃农夫行走（dumbbell-farmers-walk）|1|5|
|老年|壶铃农夫行走（kettlebell-farmers-walk）|1|2|
|老年|壶铃弓步推举（kettlebell-lunge-press）|1|1|
|老年|登山跑（mountain-climbers）|1|19|
|老年|登阶（step-ups）|1|1|
|老年|单侧提重行走（suitcase-carry）|1|3|
|老年|步行（walking）|1|50|
|孕期|登山跑（mountain-climbers）|1|3|
|孕期|单侧提重行走（suitcase-carry）|1|1|
|孕期|步行（walking）|1|17|

## 验证范围与清单修复

最终本地npm test：3326项功能测试及2项全量诊断验收通过，29项原有外部／付费条件测试未执行，无新增跳过。6个训练引擎浏览器流程通过；样式检查0违规。数据检查原327条基线保持，再精确核对本轮新增的 mechanic/copy 各一条，总数329；动作覆盖数据检查与构建通过。

全量之后只修正规则库存检查，并重新生成覆盖报告。未改写全量证据的sourceHash。仅构建、不执行的审计程序比较：剔除调用参数中的worker路径、启动时间、sourceHash后，主程序3,312,638字节完全一致（SHA-256 `45a8ccf93b777605f61deb2d7c891fe266dda03e28fc7d41dc9dab3bac750b6c`）；worker程序也逐字节一致（SHA-256 `224fd21fc7aa2982ae193e86bb9e28db2dd50edc5e2918b3d8b67daebe83c774`）。因此不为清单元数据再跑本地2200；CI在最终提交上重新验证。

## 最终上限反例修复（以上本地完整统计属于 f4d9936）

后续隔离反例证实：目录默认组数上界3不能当作硬上限4。生成候选与独立容量复核现均从真实硬规则取力量组数上限，仍逐步执行全部硬规则和专项剂量；低强度内容保持各自剂量。新增反例先红后绿，23项相关测试通过。

golden20、80和177问题画像复核仍零硬违规/空计划；golden中1份和80中1份输出改变，不能声称逐字节一致。对应黄金快照更新1份，安全及独立校验断言保留。全部功能测试3327项通过（全套仅1份预期快照失败，更新后21项黄金测试通过），29项既有外部/付费条件测试未执行。类型检查通过。

没有重复运行本地2200，也未改写旧证据hash。最终提交由CI重新执行完整诊断；其时长单列字段、5%保护、目标课程最低比值和全部200极端画像的50%保护一并输出/断言。最终指标与预览部署结果以该提交CI及PR说明为准。

## CI关闭开关兼容修复

2ed9a98的远程主检查已重新验证2000+200：硬违规/空计划0、覆盖100%，原始及单列时长97.947761%，短课0%，目标最短90%/极端90.5%，两类低于50%均0。browser-flows旧版关闭引擎场景因无条件完整准入导致换动作列表为空；恢复原保守子集兼容后，原浏览器用例不变通过，活跃引擎非法选择/保存仍拒绝。11项针对性单测、3331项完整功能测试、类型检查通过。此次只改应用兼容，不改训练引擎、规则或评分。最终提交CI与预览状态见PR说明。
