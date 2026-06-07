(function () {
  window.PROGRESS_TRACKER_CATEGORIES = [
  {
    "id": "softwareCopyright",
    "name": "软著",
    "icon": "软",
    "description": "软件著作权项目台账，跟踪材料准备、系统提交和项目路径。",
    "titleField": "githubProjectName",
    "ownerField": "",
    "statusField": "status",
    "progressField": "",
    "dueDateField": "plannedDueDate",
    "fields": [
      {
        "key": "status",
        "label": "状态",
        "type": "select",
        "options": [
          "暂缓",
          "开发完成",
          "已提交系统"
        ],
        "defaultValue": "暂缓"
      },
      {
        "key": "githubProjectName",
        "label": "GitHub项目名称",
        "type": "text"
      },
      {
        "key": "chineseDescription",
        "label": "中文解释",
        "type": "longtext"
      },
      {
        "key": "windowsPath",
        "label": "Windows路径",
        "type": "path"
      },
      {
        "key": "serverAbsolutePath",
        "label": "服务器绝对路径",
        "type": "path"
      },
      {
        "key": "githubUrl",
        "label": "GitHub地址",
        "type": "url"
      },
      {
        "key": "plannedDueDate",
        "label": "计划截止日期",
        "type": "date"
      }
    ],
    "seedRows": [
      {
        "status": "暂缓",
        "githubProjectName": "ai-based-intelligent-qa-system-for-railway",
        "chineseDescription": "面向铁道领域知识的AI智能问答系统",
        "windowsPath": "D:\\workspace\\front\\ai-based-intelligent-qa-system-for-railway",
        "serverAbsolutePath": "/ds1/workspace/front/ai-based-intelligent-qa-system-for-railway",
        "githubUrl": "git@github.com:XuelinHu/ai-based-intelligent-qa-system-for-railway.git",
        "plannedDueDate": ""
      },
      {
        "status": "暂缓",
        "githubProjectName": "DS-OCR2-3090-Runner",
        "chineseDescription": "深度OCR模型运行管理软件",
        "windowsPath": "D:\\workspace\\ai\\DS-OCR2-3090-Runner",
        "serverAbsolutePath": "/ds1/workspace/ai/DS-OCR2-3090-Runner",
        "githubUrl": "git@github.com:XuelinHu/DS-OCR2-3090-Runner.git",
        "plannedDueDate": ""
      },
      {
        "status": "开发完成",
        "githubProjectName": "chinese-vietnamese-railway-term-learning",
        "chineseDescription": "面向越南留学生的铁道专业汉越术语翻译学习软件V1.0",
        "windowsPath": "D:\\workspace\\front\\chinese-vietnamese-railway-term-learning",
        "serverAbsolutePath": "/ds1/workspace/front/chinese-vietnamese-railway-term-learning",
        "githubUrl": "git@github.com:XuelinHu/chinese-vietnamese-railway-term-learning.git",
        "plannedDueDate": ""
      },
      {
        "status": "开发完成",
        "githubProjectName": "school-chinese-exam-practice",
        "chineseDescription": "马来西亚留学生汉语练习平台",
        "windowsPath": "D:\\workspace\\front\\school-chinese-exam-practice",
        "serverAbsolutePath": "/ds1/workspace/front/school-chinese-exam-practice",
        "githubUrl": "git@github.com:XuelinHu/school-chinese-exam-practice.git",
        "plannedDueDate": ""
      },
      {
        "status": "开发完成",
        "githubProjectName": "southeast-asian-student-service-platform",
        "chineseDescription": "面向国际留学生的信息管理系统V1.0",
        "windowsPath": "D:\\workspace\\front\\southeast-asian-student-service-platform",
        "serverAbsolutePath": "/ds1/workspace/front/southeast-asian-student-service-platform",
        "githubUrl": "git@github.com:XuelinHu/southeast-asian-student-service-platform.git",
        "plannedDueDate": ""
      },
      {
        "status": "已提交系统",
        "githubProjectName": "railway_sign",
        "chineseDescription": "山区铁道信号灯数字孪生系统",
        "windowsPath": "D:\\workspace\\front\\railway_sign",
        "serverAbsolutePath": "/ds1/workspace/front/railway_sign",
        "githubUrl": "git@github.com:XuelinHu/railway_sign.git",
        "plannedDueDate": ""
      },
      {
        "status": "已提交系统",
        "githubProjectName": "school-bike-rent-international",
        "chineseDescription": "国际化学生单车租赁软件",
        "windowsPath": "D:\\workspace\\front\\school-bike-rent-international",
        "serverAbsolutePath": "/ds1/workspace/front/school-bike-rent-international",
        "githubUrl": "git@github.com:XuelinHu/school-bike-rent-international.git",
        "plannedDueDate": ""
      },
      {
        "status": "暂缓",
        "githubProjectName": "railway-signal-runner",
        "chineseDescription": "第一人称铁道信号巡视小游戏",
        "windowsPath": "D:\\workspace\\front\\railway-signal-runner",
        "serverAbsolutePath": "/ds1/workspace/front/railway-signal-runner",
        "githubUrl": "git@github.com:XuelinHu/railway-signal-runner.git",
        "plannedDueDate": ""
      },
      {
        "status": "暂缓",
        "githubProjectName": "railway-power-operation-video-ai-evaluator",
        "chineseDescription": "铁路电力作业视频智能评估软件",
        "windowsPath": "D:\\workspace\\ai\\railway-power-operation-video-ai-evaluator",
        "serverAbsolutePath": "/ds1/workspace/ai/railway-power-operation-video-ai-evaluator",
        "githubUrl": "git@github.com:XuelinHu/railway-power-operation-video-ai-evaluator.git",
        "plannedDueDate": ""
      },
      {
        "status": "暂缓",
        "githubProjectName": "OralSEAChinese",
        "chineseDescription": "中文口语语义评估软件",
        "windowsPath": "D:\\workspace\\ai\\OralSEAChinese",
        "serverAbsolutePath": "/ds1/workspace/ai/OralSEAChinese",
        "githubUrl": "git@github.com:XuelinHu/OralSEAChinese.git",
        "plannedDueDate": ""
      }
    ]
  },
  {
    "id": "patent",
    "name": "专利",
    "icon": "专",
    "description": "专利申报项目台账，跟踪题名、技术说明和资料路径。",
    "titleField": "githubProjectName",
    "ownerField": "",
    "statusField": "status",
    "progressField": "",
    "dueDateField": "plannedDueDate",
    "fields": [
      {
        "key": "status",
        "label": "状态",
        "type": "select",
        "options": [
          "暂缓",
          "等待"
        ],
        "defaultValue": "暂缓"
      },
      {
        "key": "githubProjectName",
        "label": "GitHub项目名称",
        "type": "text"
      },
      {
        "key": "chineseDescription",
        "label": "中文解释",
        "type": "longtext"
      },
      {
        "key": "windowsPath",
        "label": "Windows路径",
        "type": "path"
      },
      {
        "key": "linuxPath",
        "label": "Linux路径",
        "type": "path"
      },
      {
        "key": "serverAbsolutePath",
        "label": "服务器绝对路径",
        "type": "path"
      },
      {
        "key": "githubUrl",
        "label": "GitHub地址",
        "type": "url"
      },
      {
        "key": "plannedDueDate",
        "label": "计划截止日期",
        "type": "date"
      }
    ],
    "seedRows": [
      {
        "status": "暂缓",
        "githubProjectName": "一种卡扣组装式显示器桌边挂载支架",
        "chineseDescription": "一种卡扣组装式显示器桌边挂载支架",
        "windowsPath": "",
        "linuxPath": "",
        "serverAbsolutePath": "",
        "githubUrl": "",
        "plannedDueDate": ""
      },
      {
        "status": "暂缓",
        "githubProjectName": "一种卡槽式拼接笔记本电脑散热支架",
        "chineseDescription": "一种卡槽式拼接笔记本电脑散热支架",
        "windowsPath": "",
        "linuxPath": "",
        "serverAbsolutePath": "",
        "githubUrl": "",
        "plannedDueDate": ""
      },
      {
        "status": "等待",
        "githubProjectName": "AI智能眼镜",
        "chineseDescription": "AI智能眼镜",
        "windowsPath": "",
        "linuxPath": "",
        "serverAbsolutePath": "",
        "githubUrl": "",
        "plannedDueDate": ""
      }
    ]
  },
  {
    "id": "paper",
    "name": "论文",
    "icon": "论",
    "description": "论文项目台账，跟踪论文方向、代码仓库和提交进度。",
    "titleField": "githubProjectName",
    "ownerField": "",
    "statusField": "status",
    "progressField": "",
    "dueDateField": "plannedDueDate",
    "fields": [
      {
        "key": "status",
        "label": "状态",
        "type": "select",
        "options": [
          "已提交",
          "暂缓"
        ],
        "defaultValue": "已提交"
      },
      {
        "key": "githubProjectName",
        "label": "GitHub项目名称",
        "type": "text"
      },
      {
        "key": "chineseDescription",
        "label": "中文解释",
        "type": "longtext"
      },
      {
        "key": "windowsPath",
        "label": "Windows路径",
        "type": "path"
      },
      {
        "key": "linuxPath",
        "label": "Linux路径",
        "type": "path"
      },
      {
        "key": "githubUrl",
        "label": "GitHub地址",
        "type": "url"
      },
      {
        "key": "plannedDueDate",
        "label": "计划截止日期",
        "type": "date"
      }
    ],
    "seedRows": [
      {
        "status": "已提交",
        "githubProjectName": "Graph-Neural-Networks-A-Comprehensive-Survey",
        "chineseDescription": "综述",
        "windowsPath": "D:\\paper\\Graph-Neural-Networks-A-Comprehensive-Survey",
        "linuxPath": "",
        "githubUrl": "",
        "plannedDueDate": ""
      },
      {
        "status": "已提交",
        "githubProjectName": "KG-CrossResGNN-CropPhenoGene",
        "chineseDescription": "作物表型基因知识图谱分析软件",
        "windowsPath": "D:\\workspace\\ai\\KG-CrossResGNN-CropPhenoGene",
        "linuxPath": "/ds1/workspace/ai/KG-CrossResGNN-CropPhenoGene",
        "githubUrl": "git@github.com:XuelinHu/KG-CrossResGNN-CropPhenoGene.git",
        "plannedDueDate": ""
      },
      {
        "status": "已提交",
        "githubProjectName": "Matrix-ResGNN-GraphClassification",
        "chineseDescription": "矩阵残差图神经网络分类软件",
        "windowsPath": "D:\\workspace\\ai\\Matrix-ResGNN-GraphClassificatio",
        "linuxPath": "/ds1/workspace/ai/Matrix-ResGNN-GraphClassification",
        "githubUrl": "git@github.com:XuelinHu/Matrix-ResGNN-GraphClassificatio.git",
        "plannedDueDate": ""
      },
      {
        "status": "暂缓",
        "githubProjectName": "QDCR-Net",
        "chineseDescription": "水下图片目标识别",
        "windowsPath": "D:\\workspace\\ai\\QDCR-Net",
        "linuxPath": "/ds1/workspace/ai/QDCR-Net",
        "githubUrl": "git@github.com:XuelinHu/QDCR-Net.git",
        "plannedDueDate": ""
      },
      {
        "status": "暂缓",
        "githubProjectName": "multilingual-railway-llm-edu",
        "chineseDescription": "多语种铁路大模型教育软件",
        "windowsPath": "D:\\workspace\\ai\\multilingual-railway-llm-edu",
        "linuxPath": "/ds1/workspace/ai/multilingual-railway-llm-edu",
        "githubUrl": "git@github.com:XuelinHu/multilingual-railway-llm-edu.git",
        "plannedDueDate": ""
      },
      {
        "status": "暂缓",
        "githubProjectName": "railway-qa-agent",
        "chineseDescription": "铁路知识问答智能助手软件",
        "windowsPath": "D:\\workspace\\ai\\railway-qa-agent",
        "linuxPath": "/ds1/workspace/ai/railway-qa-agent",
        "githubUrl": "git@github.com:XuelinHu/railway-qa-agent.git",
        "plannedDueDate": ""
      },
      {
        "status": "暂缓",
        "githubProjectName": "resource-constrained-llm-eval",
        "chineseDescription": "资源受限大模型评测软件",
        "windowsPath": "D:\\workspace\\ai\\resource-constrained-llm-eval",
        "linuxPath": "/ds1/workspace/ai/resource-constrained-llm-eval",
        "githubUrl": "git@github.com:XuelinHu/resource-constrained-llm-eval.git",
        "plannedDueDate": ""
      },
      {
        "status": "暂缓",
        "githubProjectName": "resource-constrained-railway-image-captioning",
        "chineseDescription": "资源受限铁路图像描述生成软件",
        "windowsPath": "D:\\workspace\\ai\\resource-constrained-railway-image-captioning",
        "linuxPath": "/ds1/workspace/ai/resource-constrained-railway-image-captioning",
        "githubUrl": "git@github.com:XuelinHu/resource-constrained-railway-image-captioning.git",
        "plannedDueDate": ""
      }
    ]
  },
  {
    "id": "competition",
    "name": "比赛",
    "icon": "赛",
    "description": "竞赛项目台账，跟踪报名、比赛日期、平台和官网入口。",
    "titleField": "githubProjectName",
    "ownerField": "",
    "statusField": "status",
    "progressField": "",
    "dueDateField": "plannedDueDate",
    "fields": [
      {
        "key": "status",
        "label": "状态",
        "type": "select",
        "options": [
          "进行中",
          "已提交",
          "结束"
        ],
        "defaultValue": "进行中"
      },
      {
        "key": "githubProjectName",
        "label": "GitHub项目名称",
        "type": "text"
      },
      {
        "key": "recentCompetitionDate",
        "label": "最近比赛日期",
        "type": "longtext"
      },
      {
        "key": "platformUrl",
        "label": "平台网址",
        "type": "url"
      },
      {
        "key": "officialWebsite",
        "label": "官网",
        "type": "url"
      },
      {
        "key": "plannedDueDate",
        "label": "计划截止日期",
        "type": "date"
      }
    ],
    "seedRows": [
      {
        "status": "进行中",
        "githubProjectName": "2026全国大学生“麟创杯”创新数学竞赛",
        "recentCompetitionDate": "2026年8月22日10:00-23:00",
        "platformUrl": "https://new.saikr.com/vse/DFIC2026Robot",
        "officialWebsite": "https://new.saikr.com/vse/DFIC2026Robot",
        "plannedDueDate": ""
      },
      {
        "status": "进行中",
        "githubProjectName": "2026“华青杯”【AI机器人赛项】",
        "recentCompetitionDate": "2026年6月27日10:00——2026年6月28日18:00期间任选一小时参与答题【正在报名中】",
        "platformUrl": "https://new.saikr.com/vse/LCBCXSX",
        "officialWebsite": "https://new.saikr.com/vse/LCBCXSX",
        "plannedDueDate": ""
      },
      {
        "status": "进行中",
        "githubProjectName": "2026年第十六届APMCM亚太地区大学生数学建模竞赛（中文赛项）",
        "recentCompetitionDate": "报名时间：即日起至2026年6月12日12：00\n比赛时间：2026年6月12日18：00至2026年6月15日20：00",
        "platformUrl": "https://new.saikr.com/vse/apmcm2602",
        "officialWebsite": "",
        "plannedDueDate": ""
      },
      {
        "status": "进行中",
        "githubProjectName": "中国研究生人工智能创新大赛",
        "recentCompetitionDate": "2026年09月01日 提交作品",
        "platformUrl": "https://cpipc.acge.org.cn/cw/hp/2c9088a5696cbf370169a3f8101510bd",
        "officialWebsite": "",
        "plannedDueDate": ""
      },
      {
        "status": "已提交",
        "githubProjectName": "",
        "recentCompetitionDate": "",
        "platformUrl": "",
        "officialWebsite": "",
        "plannedDueDate": ""
      },
      {
        "status": "已提交",
        "githubProjectName": "",
        "recentCompetitionDate": "",
        "platformUrl": "",
        "officialWebsite": "",
        "plannedDueDate": ""
      },
      {
        "status": "结束",
        "githubProjectName": "",
        "recentCompetitionDate": "",
        "platformUrl": "",
        "officialWebsite": "",
        "plannedDueDate": ""
      },
      {
        "status": "结束",
        "githubProjectName": "",
        "recentCompetitionDate": "",
        "platformUrl": "",
        "officialWebsite": "",
        "plannedDueDate": ""
      },
      {
        "status": "结束",
        "githubProjectName": "",
        "recentCompetitionDate": "",
        "platformUrl": "",
        "officialWebsite": "",
        "plannedDueDate": ""
      }
    ]
  }
];
})();
