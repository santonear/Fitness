# Training engine V2 acceptance report

Functional correctness evidence. Timing is informational only; engine:perf reports three independent cold 80-profile runs separately.

```json
{
  "version": 3,
  "sourceHash": "96eb6553bfca72301ed634e623573bacc6fc41abd5d73883e94e9e5d6d336ff8",
  "inputHash": "58eec36583cead086e435eeb3ceb10bcbf82c9ecf911bd4dcfb509a0bff10332",
  "seed": 20261015,
  "nodeVersion": "v24.14.0",
  "runtimeFingerprint": "670a0b0516d2baa29f38405873b784232e6c52e72a83907905cd2e2906ca7dc5",
  "wallMs": 110446.40893554688,
  "report": {
    "stage": "V2 diagnostic",
    "pregnancyRamp": {
      "weightedCount": 29,
      "extremeCount": 0,
      "excludedFromCapacityShortageLimit": true,
      "profiles": [
        {
          "index": 5,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 30,
          "trainingAgeWeeks": 20,
          "courses": [
            {
              "templateId": "day-96438042",
              "actualSeconds": 1765,
              "targetMinutes": 30
            },
            {
              "templateId": "day-5240d69f",
              "actualSeconds": 1714,
              "targetMinutes": 30
            },
            {
              "templateId": "day-52479264",
              "actualSeconds": 1735,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 170,
          "extreme": false,
          "requestedMinutes": 20,
          "capMinutes": 10,
          "trainingAgeWeeks": 0,
          "courses": [
            {
              "templateId": "day-0fdee27b",
              "actualSeconds": 578,
              "targetMinutes": 10
            },
            {
              "templateId": "day-13e1275e",
              "actualSeconds": 589,
              "targetMinutes": 10
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 205,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 30,
          "trainingAgeWeeks": 67,
          "courses": [
            {
              "templateId": "day-8fe7438a",
              "actualSeconds": 1678,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 324,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 30,
          "trainingAgeWeeks": 100,
          "courses": [
            {
              "templateId": "day-8c5bbcb0",
              "actualSeconds": 1799,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 397,
          "extreme": false,
          "requestedMinutes": 40,
          "capMinutes": 30,
          "trainingAgeWeeks": 10,
          "courses": [
            {
              "templateId": "day-b210fb72",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-ae0eb68f",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-ae170554",
              "actualSeconds": 1790,
              "targetMinutes": 30
            },
            {
              "templateId": "day-f2139ec9",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-f21bed8e",
              "actualSeconds": 1785,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 443,
          "extreme": false,
          "requestedMinutes": 30,
          "capMinutes": 25,
          "trainingAgeWeeks": 3,
          "courses": [
            {
              "templateId": "day-7dc9ab3f",
              "actualSeconds": 1403,
              "targetMinutes": 25
            },
            {
              "templateId": "day-41cd1e62",
              "actualSeconds": 1450,
              "targetMinutes": 25
            },
            {
              "templateId": "day-41cf5cf9",
              "actualSeconds": 1499,
              "targetMinutes": 25
            },
            {
              "templateId": "day-7dd1fa04",
              "actualSeconds": 1499,
              "targetMinutes": 25
            },
            {
              "templateId": "day-3dd3d3db",
              "actualSeconds": 1499,
              "targetMinutes": 25
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 524,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 30,
          "trainingAgeWeeks": 68,
          "courses": [
            {
              "templateId": "day-a1634396",
              "actualSeconds": 1709,
              "targetMinutes": 30
            },
            {
              "templateId": "day-dd5fd073",
              "actualSeconds": 1679,
              "targetMinutes": 30
            },
            {
              "templateId": "day-dd681f38",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-e165e6ed",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-a158b63a",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-dd56d617",
              "actualSeconds": 1800,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 605,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 10,
          "trainingAgeWeeks": 0,
          "courses": [
            {
              "templateId": "day-0f64c446",
              "actualSeconds": 572,
              "targetMinutes": 10
            },
            {
              "templateId": "day-0b627f63",
              "actualSeconds": 571,
              "targetMinutes": 10
            },
            {
              "templateId": "day-0b693b28",
              "actualSeconds": 600,
              "targetMinutes": 10
            },
            {
              "templateId": "day-cf669e1d",
              "actualSeconds": 555,
              "targetMinutes": 10
            },
            {
              "templateId": "day-0f5a36ea",
              "actualSeconds": 600,
              "targetMinutes": 10
            },
            {
              "templateId": "day-0b57f207",
              "actualSeconds": 600,
              "targetMinutes": 10
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 624,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 30,
          "trainingAgeWeeks": 6,
          "courses": [
            {
              "templateId": "day-5ef6bf86",
              "actualSeconds": 1772,
              "targetMinutes": 30
            },
            {
              "templateId": "day-5af47aa3",
              "actualSeconds": 1644,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 697,
          "extreme": false,
          "requestedMinutes": 40,
          "capMinutes": 30,
          "trainingAgeWeeks": 63,
          "courses": [
            {
              "templateId": "day-404ff659",
              "actualSeconds": 1799.5,
              "targetMinutes": 30
            },
            {
              "templateId": "day-fc51c9e4",
              "actualSeconds": 1650.5,
              "targetMinutes": 30
            },
            {
              "templateId": "day-fc4b0e1f",
              "actualSeconds": 1715,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 724,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 30,
          "trainingAgeWeeks": 27,
          "courses": [
            {
              "templateId": "day-bafeb0d5",
              "actualSeconds": 1685,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 805,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 25,
          "trainingAgeWeeks": 3,
          "courses": [
            {
              "templateId": "day-b726c54c",
              "actualSeconds": 1451,
              "targetMinutes": 25
            },
            {
              "templateId": "day-bb248d01",
              "actualSeconds": 1499.5,
              "targetMinutes": 25
            },
            {
              "templateId": "day-fb22b32a",
              "actualSeconds": 1500,
              "targetMinutes": 25
            },
            {
              "templateId": "day-f7206e47",
              "actualSeconds": 1499,
              "targetMinutes": 25
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 897,
          "extreme": false,
          "requestedMinutes": 40,
          "capMinutes": 30,
          "trainingAgeWeeks": 99,
          "courses": [
            {
              "templateId": "day-bd8eb145",
              "actualSeconds": 1772,
              "targetMinutes": 30
            },
            {
              "templateId": "day-f9914e50",
              "actualSeconds": 1678,
              "targetMinutes": 30
            },
            {
              "templateId": "day-f988ff8b",
              "actualSeconds": 1730,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 924,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 30,
          "trainingAgeWeeks": 4,
          "courses": [
            {
              "templateId": "day-31781a53",
              "actualSeconds": 1780,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 997,
          "extreme": false,
          "requestedMinutes": 40,
          "capMinutes": 30,
          "trainingAgeWeeks": 12,
          "courses": [
            {
              "templateId": "day-cc835b00",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-d08122b5",
              "actualSeconds": 1714,
              "targetMinutes": 30
            },
            {
              "templateId": "day-107f48de",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-0c7d03fb",
              "actualSeconds": 1785,
              "targetMinutes": 30
            },
            {
              "templateId": "day-cc7a60a4",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-1076fa19",
              "actualSeconds": 1785,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 1005,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 10,
          "trainingAgeWeeks": 0,
          "courses": [
            {
              "templateId": "day-35f5dfca",
              "actualSeconds": 551,
              "targetMinutes": 10
            },
            {
              "templateId": "day-31f39ae7",
              "actualSeconds": 591,
              "targetMinutes": 10
            },
            {
              "templateId": "day-71fabb6c",
              "actualSeconds": 600,
              "targetMinutes": 10
            },
            {
              "templateId": "day-75f88321",
              "actualSeconds": 600,
              "targetMinutes": 10
            },
            {
              "templateId": "day-35feda26",
              "actualSeconds": 600,
              "targetMinutes": 10
            },
            {
              "templateId": "day-31fc9543",
              "actualSeconds": 600,
              "targetMinutes": 10
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 1105,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 30,
          "trainingAgeWeeks": 80,
          "courses": [
            {
              "templateId": "day-f4699e58",
              "actualSeconds": 1730,
              "targetMinutes": 30
            },
            {
              "templateId": "day-f867660d",
              "actualSeconds": 1740,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 1197,
          "extreme": false,
          "requestedMinutes": 40,
          "capMinutes": 30,
          "trainingAgeWeeks": 72,
          "courses": [
            {
              "templateId": "day-0ad18867",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-0ed3cd4a",
              "actualSeconds": 1679,
              "targetMinutes": 30
            },
            {
              "templateId": "day-4ed670a1",
              "actualSeconds": 1705,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 1205,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 30,
          "trainingAgeWeeks": 70,
          "courses": [
            {
              "templateId": "day-8743898a",
              "actualSeconds": 1779,
              "targetMinutes": 30
            },
            {
              "templateId": "day-834144a7",
              "actualSeconds": 1711,
              "targetMinutes": 30
            },
            {
              "templateId": "day-c348652c",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-c7462ce1",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-874e16e6",
              "actualSeconds": 1650,
              "targetMinutes": 30
            },
            {
              "templateId": "day-834bd203",
              "actualSeconds": 1800,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 1297,
          "extreme": false,
          "requestedMinutes": 40,
          "capMinutes": 25,
          "trainingAgeWeeks": 3,
          "courses": [
            {
              "templateId": "day-f781625c",
              "actualSeconds": 1360,
              "targetMinutes": 25
            },
            {
              "templateId": "day-bb7ec551",
              "actualSeconds": 1400,
              "targetMinutes": 25
            },
            {
              "templateId": "day-bb7c86ba",
              "actualSeconds": 1500,
              "targetMinutes": 25
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 1324,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 30,
          "trainingAgeWeeks": 24,
          "courses": [
            {
              "templateId": "day-38f02733",
              "actualSeconds": 1796,
              "targetMinutes": 30
            },
            {
              "templateId": "day-fcf20756",
              "actualSeconds": 1697,
              "targetMinutes": 30
            },
            {
              "templateId": "day-3cf4aaad",
              "actualSeconds": 1785,
              "targetMinutes": 30
            },
            {
              "templateId": "day-38f6e2f8",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-38e599d7",
              "actualSeconds": 1800,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 1424,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 25,
          "trainingAgeWeeks": 3,
          "courses": [
            {
              "templateId": "day-a1c74069",
              "actualSeconds": 1500,
              "targetMinutes": 25
            },
            {
              "templateId": "day-ddc9dd74",
              "actualSeconds": 1498,
              "targetMinutes": 25
            },
            {
              "templateId": "day-ddc321af",
              "actualSeconds": 1395,
              "targetMinutes": 25
            },
            {
              "templateId": "day-e1c56692",
              "actualSeconds": 1380,
              "targetMinutes": 25
            },
            {
              "templateId": "day-a1d1cdc5",
              "actualSeconds": 1500,
              "targetMinutes": 25
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 1497,
          "extreme": false,
          "requestedMinutes": 40,
          "capMinutes": 30,
          "trainingAgeWeeks": 83,
          "courses": [
            {
              "templateId": "day-b2da39fb",
              "actualSeconds": 1723,
              "targetMinutes": 30
            },
            {
              "templateId": "day-b6dc7ede",
              "actualSeconds": 1776,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 1505,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 30,
          "trainingAgeWeeks": 59,
          "courses": [
            {
              "templateId": "day-69cb84c4",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-2dc8e7b9",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-2dc6a922",
              "actualSeconds": 1665,
              "targetMinutes": 30
            },
            {
              "templateId": "day-69c4c8ff",
              "actualSeconds": 1665,
              "targetMinutes": 30
            },
            {
              "templateId": "day-69d61220",
              "actualSeconds": 1665,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 1697,
          "extreme": false,
          "requestedMinutes": 40,
          "capMinutes": 25,
          "trainingAgeWeeks": 3,
          "courses": [
            {
              "templateId": "day-58668171",
              "actualSeconds": 1421,
              "targetMinutes": 25
            },
            {
              "templateId": "day-146854fc",
              "actualSeconds": 1402,
              "targetMinutes": 25
            },
            {
              "templateId": "day-14619937",
              "actualSeconds": 1500,
              "targetMinutes": 25
            },
            {
              "templateId": "day-586442da",
              "actualSeconds": 1499,
              "targetMinutes": 25
            },
            {
              "templateId": "day-1870aa0d",
              "actualSeconds": 1500,
              "targetMinutes": 25
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 1724,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 20,
          "trainingAgeWeeks": 2,
          "courses": [
            {
              "templateId": "day-e04205c9",
              "actualSeconds": 1193,
              "targetMinutes": 20
            },
            {
              "templateId": "day-9c456c54",
              "actualSeconds": 1124,
              "targetMinutes": 20
            },
            {
              "templateId": "day-9c3d1d8f",
              "actualSeconds": 1200,
              "targetMinutes": 20
            },
            {
              "templateId": "day-a03f6272",
              "actualSeconds": 1198,
              "targetMinutes": 20
            },
            {
              "templateId": "day-e04c9325",
              "actualSeconds": 1200,
              "targetMinutes": 20
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 1805,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 30,
          "trainingAgeWeeks": 43,
          "courses": [
            {
              "templateId": "day-b02f30d0",
              "actualSeconds": 1758,
              "targetMinutes": 30
            },
            {
              "templateId": "day-742c93c5",
              "actualSeconds": 1696,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 1824,
          "extreme": false,
          "requestedMinutes": 45,
          "capMinutes": 30,
          "trainingAgeWeeks": 77,
          "courses": [
            {
              "templateId": "day-edb93ee4",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-31b76b59",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-31b52cc2",
              "actualSeconds": 1700,
              "targetMinutes": 30
            },
            {
              "templateId": "day-edb2831f",
              "actualSeconds": 1700,
              "targetMinutes": 30
            },
            {
              "templateId": "day-edc3cc40",
              "actualSeconds": 1700,
              "targetMinutes": 30
            },
            {
              "templateId": "day-f1c193f5",
              "actualSeconds": 1800,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        },
        {
          "index": 1897,
          "extreme": false,
          "requestedMinutes": 40,
          "capMinutes": 30,
          "trainingAgeWeeks": 50,
          "courses": [
            {
              "templateId": "day-8157f385",
              "actualSeconds": 1788,
              "targetMinutes": 30
            },
            {
              "templateId": "day-bd5a9090",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-bd53d4cb",
              "actualSeconds": 1800,
              "targetMinutes": 30
            },
            {
              "templateId": "day-8155b4ee",
              "actualSeconds": 1785,
              "targetMinutes": 30
            },
            {
              "templateId": "day-814ef929",
              "actualSeconds": 1790,
              "targetMinutes": 30
            }
          ],
          "withinCap": true,
          "disclosed": true
        }
      ]
    },
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
        "score": 0.4111044973544974
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
        "score": 0.5549319727891157
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
        "score": 0.5263772175536882
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
        "score": 0.5795282898105478
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
        "score": 0.5762256784434203
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
        "score": 0.5176984126984128
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
        "index": 1697,
        "score": 0.5919733044733045
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
    "qualityMedian": 0.7682782191992092,
    "qualityP10": 0.6008838752166401,
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
      "minimumExtremeDurationRatio": 0.905,
      "extremeBelow50Count": 0,
      "extremeIntentionalShortCount": 0,
      "shortageProfiles": [],
      "averageGapSeconds": 0,
      "maxGapSeconds": 0
    },
    "coverageRate": 1,
    "notices": {
      "engine.copy.target_volume": 1764,
      "engine.copy.target_aerobic": 1849,
      "session.copy.short_stretch_target": 736,
      "safety.copy.clearance_needed": 610,
      "safety.copy.age45_advisory": 350,
      "pregnancy.stop.copy.stop": 210,
      "session.copy.intentional_short": 39,
      "pregnancy.pelvic_floor.copy": 95,
      "postpartum.copy.urgent.urgent": 151,
      "engine.copy.target_balance": 24,
      "postpartum.gate.pre_check.copy": 70,
      "safety.copy.illness_pause": 89,
      "postpartum.pelvic_floor.copy": 52,
      "postpartum.physio_offer.offer": 22,
      "pregnancy.copy.long_session.copy": 15
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
        "weightedLoss": 222.0047787608918
      },
      {
        "id": "dose.sets_week.intermediate",
        "weightedLoss": 204.2367424242424
      },
      {
        "id": "balance.week.hinge_knee",
        "weightedLoss": 161.7414238422642
      },
      {
        "id": "goal.aerobic.baseline",
        "weightedLoss": 157.015
      },
      {
        "id": "aerobic.target.weekly",
        "weightedLoss": 157.015
      },
      {
        "id": "dose.sets_week.beginner",
        "weightedLoss": 154.8472222222222
      },
      {
        "id": "session.warmup.general",
        "weightedLoss": 140.25314814814817
      },
      {
        "id": "dose.sets_week.goal_matrix",
        "weightedLoss": 118.84270833333333
      },
      {
        "id": "session.warmup.dynamic",
        "weightedLoss": 99.76740740740739
      },
      {
        "id": "goal.params.health",
        "weightedLoss": 77.98786745980571
      },
      {
        "id": "session.cooldown.stretch",
        "weightedLoss": 75.99738095238094
      },
      {
        "id": "week.frequency.per_muscle",
        "weightedLoss": 74
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
        "weightedLoss": 48.80983051143062
      },
      {
        "id": "goal.params.mobility",
        "weightedLoss": 41.263540784208594
      },
      {
        "id": "select.unilateral.weekly",
        "weightedLoss": 36
      },
      {
        "id": "balance.week.core_three",
        "weightedLoss": 33
      },
      {
        "id": "caution.back.keep_active",
        "weightedLoss": 31.738333333333333
      },
      {
        "id": "goal.params.strength",
        "weightedLoss": 23.11445993528833
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
        "id": "session.warmup.balance_older",
        "weightedLoss": 15.958333333333332
      },
      {
        "id": "goal.params.start_moving",
        "weightedLoss": 15.598052883215239
      },
      {
        "id": "safety.session.warmup_cooldown",
        "weightedLoss": 12.919861111111112
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
        "id": "progression.new.weekly_sets",
        "weightedLoss": 7.927083333333333
      },
      {
        "id": "pregnancy.week.target",
        "weightedLoss": 7.400000000000001
      },
      {
        "id": "dose.sets_exercise",
        "weightedLoss": 7.012743362378177
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
        "weightedLoss": 1182.6629527083571,
        "count": 752,
        "applicableCount": 816,
        "averageWeightedLoss": 1.4493418538092613
      },
      {
        "id": "goal.params.fat_loss",
        "weightedLoss": 377.24702215134647,
        "count": 284,
        "applicableCount": 284,
        "averageWeightedLoss": 1.3283345850399524
      },
      {
        "id": "goal.params.muscle",
        "weightedLoss": 362.95372234861884,
        "count": 283,
        "applicableCount": 283,
        "averageWeightedLoss": 1.282521987097593
      },
      {
        "id": "goal.params.health",
        "weightedLoss": 333.9427869490542,
        "count": 265,
        "applicableCount": 265,
        "averageWeightedLoss": 1.2601614601851103
      },
      {
        "id": "dose.sets_week.beginner",
        "weightedLoss": 898.0292652679187,
        "count": 712,
        "applicableCount": 778,
        "averageWeightedLoss": 1.1542792612698185
      },
      {
        "id": "goal.params.mobility",
        "weightedLoss": 254.63218153187177,
        "count": 249,
        "applicableCount": 249,
        "averageWeightedLoss": 1.022619202939244
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
        "weightedLoss": 239.6718914635015,
        "count": 247,
        "applicableCount": 247,
        "averageWeightedLoss": 0.9703315443866458
      },
      {
        "id": "goal.aerobic.baseline",
        "weightedLoss": 1553.9701111111144,
        "count": 1608,
        "applicableCount": 1608,
        "averageWeightedLoss": 0.9663993228302951
      }
    ],
    "performance": {
      "totalMs": 110446.40893554688,
      "p95Ms": 656.4555000000109,
      "generationP95Ms": 656.4555000000109,
      "classificationP95Ms": 661.1410000000033,
      "parallelAuditWallMs": 108950.7222,
      "workerContentionP95Ms": 656.4555000000109
    }
  }
}
```
