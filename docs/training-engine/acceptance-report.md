# Training engine V2 acceptance report

Functional correctness evidence. Timing is informational only; engine:perf reports three independent cold 80-profile runs separately.

```json
{
  "version": 3,
  "sourceHash": "387bc59d54b81ba4dad1939b125f4ac7342ba319218bf3e78051681d669f4e1f",
  "inputHash": "4afe1f2f716c5ecc3bd9e1672fc47a3a0ab85db15cf4ab4c7b33b13b908c2989",
  "seed": 20261015,
  "nodeVersion": "v24.14.0",
  "runtimeFingerprint": "670a0b0516d2baa29f38405873b784232e6c52e72a83907905cd2e2906ca7dc5",
  "wallMs": 72458.9619140625,
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
        "score": 0.5753429355281208
      },
      {
        "index": 28,
        "score": 0.4583333333333333
      },
      {
        "index": 42,
        "score": 0.5400342660178427
      },
      {
        "index": 50,
        "score": 0.5535103785103785
      },
      {
        "index": 62,
        "score": 0.5532137505062777
      },
      {
        "index": 70,
        "score": 0.4930059523809524
      },
      {
        "index": 125,
        "score": 0.5443953718852252
      },
      {
        "index": 128,
        "score": 0.4254166666666667
      },
      {
        "index": 130,
        "score": 0.567037037037037
      },
      {
        "index": 134,
        "score": 0.35461822660098524
      },
      {
        "index": 140,
        "score": 0.5121474617244158
      },
      {
        "index": 145,
        "score": 0.513735632183908
      },
      {
        "index": 160,
        "score": 0.5720543569333892
      },
      {
        "index": 168,
        "score": 0.506383712905452
      },
      {
        "index": 170,
        "score": 0.5842517921146954
      },
      {
        "index": 181,
        "score": 0.5347058823529411
      },
      {
        "index": 185,
        "score": 0.4633324812542604
      },
      {
        "index": 188,
        "score": 0.4221739130434783
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
        "score": 0.5223456790123456
      },
      {
        "index": 260,
        "score": 0.5831018518518519
      },
      {
        "index": 266,
        "score": 0.4982753357753357
      },
      {
        "index": 276,
        "score": 0.4971153846153846
      },
      {
        "index": 279,
        "score": 0.5039717632669801
      },
      {
        "index": 294,
        "score": 0.5286197743632337
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
        "index": 360,
        "score": 0.49572649572649574
      },
      {
        "index": 400,
        "score": 0.5529706790123458
      },
      {
        "index": 433,
        "score": 0.44870689655172413
      },
      {
        "index": 494,
        "score": 0.5492994651967781
      },
      {
        "index": 501,
        "score": 0.5669335523526918
      },
      {
        "index": 504,
        "score": 0.449629518796454
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
        "score": 0.508323252688172
      },
      {
        "index": 569,
        "score": 0.5974321133412043
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
        "index": 635,
        "score": 0
      },
      {
        "index": 656,
        "score": 0.5942330434253171
      },
      {
        "index": 660,
        "score": 0.4982753357753357
      },
      {
        "index": 664,
        "score": 0.5118273931749291
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
        "score": 0.48854166666666665
      },
      {
        "index": 735,
        "score": 0
      },
      {
        "index": 752,
        "score": 0.5991492036174665
      },
      {
        "index": 756,
        "score": 0.5905100658149439
      },
      {
        "index": 758,
        "score": 0.5929222470238096
      },
      {
        "index": 759,
        "score": 0.5121605415908331
      },
      {
        "index": 782,
        "score": 0.5812650659892935
      },
      {
        "index": 786,
        "score": 0.5754415797640097
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
        "score": 0.501943108974359
      },
      {
        "index": 857,
        "score": 0.5990442651787452
      },
      {
        "index": 867,
        "score": 0.5811309323190011
      },
      {
        "index": 886,
        "score": 0.5756660689125145
      },
      {
        "index": 907,
        "score": 0.590065038629632
      },
      {
        "index": 920,
        "score": 0.49588477366255146
      },
      {
        "index": 935,
        "score": 0.05555555555555555
      },
      {
        "index": 948,
        "score": 0.5946826928969786
      },
      {
        "index": 966,
        "score": 0.5952380952380952
      },
      {
        "index": 994,
        "score": 0.5717424856038716
      },
      {
        "index": 1000,
        "score": 0.5810752688172044
      },
      {
        "index": 1034,
        "score": 0.5592681674565562
      },
      {
        "index": 1061,
        "score": 0.4541256157635468
      },
      {
        "index": 1068,
        "score": 0.5576895254629629
      },
      {
        "index": 1120,
        "score": 0.5531335077012496
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
        "score": 0.5358392122281012
      },
      {
        "index": 1151,
        "score": 0.5732581052811949
      },
      {
        "index": 1154,
        "score": 0.5057407407407407
      },
      {
        "index": 1166,
        "score": 0.580787037037037
      },
      {
        "index": 1170,
        "score": 0.5788370455709165
      },
      {
        "index": 1176,
        "score": 0.5875
      },
      {
        "index": 1208,
        "score": 0.5241898148148149
      },
      {
        "index": 1216,
        "score": 0.5762256784434203
      },
      {
        "index": 1226,
        "score": 0.5871031746031746
      },
      {
        "index": 1234,
        "score": 0.5396928763440861
      },
      {
        "index": 1235,
        "score": 0
      },
      {
        "index": 1245,
        "score": 0.5884575546168289
      },
      {
        "index": 1255,
        "score": 0.5843400850893242
      },
      {
        "index": 1266,
        "score": 0.5875
      },
      {
        "index": 1295,
        "score": 0.5918582375478927
      },
      {
        "index": 1322,
        "score": 0.5769918414059946
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
        "index": 1373,
        "score": 0.5873366105754081
      },
      {
        "index": 1378,
        "score": 0.4762444444444444
      },
      {
        "index": 1379,
        "score": 0.5035987306899232
      },
      {
        "index": 1387,
        "score": 0.417179802955665
      },
      {
        "index": 1400,
        "score": 0.5390625
      },
      {
        "index": 1435,
        "score": 0
      },
      {
        "index": 1460,
        "score": 0.5475543478260869
      },
      {
        "index": 1478,
        "score": 0.5127777777777778
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
        "index": 1560,
        "score": 0.5452686202686203
      },
      {
        "index": 1564,
        "score": 0.5997216063405774
      },
      {
        "index": 1589,
        "score": 0.5886247453289605
      },
      {
        "index": 1633,
        "score": 0.5952749333003996
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
        "score": 0.4804646648468305
      },
      {
        "index": 1684,
        "score": 0.4710395431522448
      },
      {
        "index": 1708,
        "score": 0.5892063492063493
      },
      {
        "index": 1718,
        "score": 0.4805224867724867
      },
      {
        "index": 1770,
        "score": 0.4918356848912405
      },
      {
        "index": 1776,
        "score": 0.5313969017094018
      },
      {
        "index": 1784,
        "score": 0.5848061279812721
      },
      {
        "index": 1835,
        "score": 0.05555555555555555
      },
      {
        "index": 1840,
        "score": 0.5519101533336579
      },
      {
        "index": 1846,
        "score": 0.5470091122868901
      },
      {
        "index": 1881,
        "score": 0
      },
      {
        "index": 1883,
        "score": 0.5767339417339418
      },
      {
        "index": 1895,
        "score": 0.3826970443349753
      },
      {
        "index": 1910,
        "score": 0.5702278061243437
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
        "index": 1960,
        "score": 0.5505915637860083
      },
      {
        "index": 1963,
        "score": 0.5832877054783719
      }
    ],
    "qualityMedian": 0.7802786711645056,
    "qualityP10": 0.6102941866585494,
    "within10Rate": 0.9819651741293532,
    "coverageRate": 1,
    "notices": {
      "engine.copy.target_volume": 1780,
      "engine.copy.target_aerobic": 1762,
      "session.copy.short_stretch_target": 828,
      "safety.copy.clearance_needed": 610,
      "safety.copy.age45_advisory": 350,
      "pregnancy.pelvic_floor.copy": 169,
      "pregnancy.stop.copy.stop": 128,
      "postpartum.copy.urgent.urgent": 153,
      "engine.copy.target_balance": 26,
      "postpartum.gate.pre_check.copy": 70,
      "safety.copy.illness_pause": 89,
      "postpartum.pelvic_floor.copy": 60,
      "postpartum.physio_offer.offer": 27
    },
    "noticeCounts": {
      "0": 0,
      "1": 31,
      "2": 444,
      "3": 1525
    },
    "extremeNoticeCounts": {
      "0": 0,
      "1": 0,
      "2": 42,
      "3": 158
    },
    "noticeOverflow": 0,
    "lowScoreLoss": [
      {
        "id": "goal.floor.all",
        "weightedLoss": 183.58012101123506
      },
      {
        "id": "dose.sets_week.intermediate",
        "weightedLoss": 170.7611111111111
      },
      {
        "id": "dose.sets_week.beginner",
        "weightedLoss": 141.72916666666666
      },
      {
        "id": "balance.week.hinge_knee",
        "weightedLoss": 137.42857142857144
      },
      {
        "id": "goal.aerobic.baseline",
        "weightedLoss": 131.8171111111111
      },
      {
        "id": "aerobic.target.weekly",
        "weightedLoss": 131.8171111111111
      },
      {
        "id": "session.warmup.general",
        "weightedLoss": 111.63611111111112
      },
      {
        "id": "dose.sets_week.goal_matrix",
        "weightedLoss": 100.45555555555553
      },
      {
        "id": "session.warmup.dynamic",
        "weightedLoss": 85.17685185185185
      },
      {
        "id": "duration.fit.tolerance",
        "weightedLoss": 69.86666666666667
      },
      {
        "id": "goal.params.health",
        "weightedLoss": 67.59408706149625
      },
      {
        "id": "week.frequency.per_muscle",
        "weightedLoss": 62
      },
      {
        "id": "session.cooldown.stretch",
        "weightedLoss": 56.64150793650795
      },
      {
        "id": "goal.params.muscle",
        "weightedLoss": 53.09375640737729
      },
      {
        "id": "goal.params.fat_loss",
        "weightedLoss": 40.609515222437
      },
      {
        "id": "goal.params.mobility",
        "weightedLoss": 38.31882250217596
      },
      {
        "id": "select.unilateral.weekly",
        "weightedLoss": 35
      },
      {
        "id": "caution.back.keep_active",
        "weightedLoss": 25.29522222222222
      },
      {
        "id": "balance.week.core_three",
        "weightedLoss": 21
      },
      {
        "id": "goal.params.strength",
        "weightedLoss": 20.491177898507704
      },
      {
        "id": "older.week.flexibility",
        "weightedLoss": 14.75
      },
      {
        "id": "older.week.aerobic",
        "weightedLoss": 14.39611111111111
      },
      {
        "id": "session.warmup.balance_older",
        "weightedLoss": 13.916666666666668
      },
      {
        "id": "goal.params.start_moving",
        "weightedLoss": 12.32123442479374
      },
      {
        "id": "older.week.strength",
        "weightedLoss": 9.357142857142858
      },
      {
        "id": "postpartum.weekly_target",
        "weightedLoss": 8.75
      },
      {
        "id": "safety.session.warmup_cooldown",
        "weightedLoss": 7.649444444444445
      },
      {
        "id": "pregnancy.week.target",
        "weightedLoss": 6.833333333333335
      },
      {
        "id": "progression.new.weekly_sets",
        "weightedLoss": 5.03125
      },
      {
        "id": "dose.sets_exercise",
        "weightedLoss": 4.546989363293711
      },
      {
        "id": "week.coverage.patterns",
        "weightedLoss": 2.8333333333333317
      },
      {
        "id": "balance.week.pull_push",
        "weightedLoss": 2
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
        "weightedLoss": 1161.7922458448395,
        "count": 741,
        "applicableCount": 816,
        "averageWeightedLoss": 1.4237650071627934
      },
      {
        "id": "goal.params.fat_loss",
        "weightedLoss": 355.34317528978374,
        "count": 284,
        "applicableCount": 284,
        "averageWeightedLoss": 1.2512083636964217
      },
      {
        "id": "goal.params.muscle",
        "weightedLoss": 351.02768866722533,
        "count": 283,
        "applicableCount": 283,
        "averageWeightedLoss": 1.2403805253258846
      },
      {
        "id": "goal.params.health",
        "weightedLoss": 303.3102811306298,
        "count": 265,
        "applicableCount": 265,
        "averageWeightedLoss": 1.1445670986061502
      },
      {
        "id": "dose.sets_week.beginner",
        "weightedLoss": 862.2060481291943,
        "count": 685,
        "applicableCount": 778,
        "averageWeightedLoss": 1.1082339950246713
      },
      {
        "id": "goal.params.mobility",
        "weightedLoss": 262.67945195852263,
        "count": 249,
        "applicableCount": 249,
        "averageWeightedLoss": 1.054937558066356
      },
      {
        "id": "session.warmup.balance_older",
        "weightedLoss": 228.61666666666667,
        "count": 229,
        "applicableCount": 229,
        "averageWeightedLoss": 0.9983260553129549
      },
      {
        "id": "older.week.flexibility",
        "weightedLoss": 236.24999999999983,
        "count": 242,
        "applicableCount": 242,
        "averageWeightedLoss": 0.9762396694214869
      },
      {
        "id": "session.cooldown.stretch",
        "weightedLoss": 1011.3025372574948,
        "count": 1110,
        "applicableCount": 1110,
        "averageWeightedLoss": 0.911083366898644
      },
      {
        "id": "goal.aerobic.baseline",
        "weightedLoss": 1301.4443333333352,
        "count": 1562,
        "applicableCount": 1608,
        "averageWeightedLoss": 0.809355928689885
      }
    ],
    "performance": {
      "totalMs": 72458.9619140625,
      "p95Ms": 417.53059999999823,
      "generationP95Ms": 417.53059999999823,
      "classificationP95Ms": 418.9597999999969,
      "parallelAuditWallMs": 71150.4048,
      "workerContentionP95Ms": 417.53059999999823
    }
  }
}
```
