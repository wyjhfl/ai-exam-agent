from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from db.models import QuizRecord, QuizQuestion

KNOWLEDGE_TREE = {
    "数学": {
        "高等数学": {
            "极限与连续": ["数列极限", "函数极限", "连续性", "间断点"],
            "一元函数微分学": ["导数", "微分", "中值定理", "洛必达法则", "单调性与极值"],
            "一元函数积分学": ["不定积分", "定积分", "反常积分", "定积分应用"],
            "多元函数微分学": ["偏导数", "全微分", "极值", "条件极值"],
            "多元函数积分学": ["二重积分", "三重积分", "曲线积分", "曲面积分"],
            "无穷级数": ["数项级数", "幂级数", "傅里叶级数"],
            "常微分方程": ["一阶", "二阶常系数", "高阶"],
        },
        "线性代数": {
            "行列式": ["性质", "计算", "克拉默法则"],
            "矩阵": ["运算", "逆矩阵", "初等变换", "秩"],
            "向量": ["线性相关", "线性表示", "秩"],
            "线性方程组": ["齐次", "非齐次", "解的结构"],
            "特征值与特征向量": ["求解", "相似", "对角化"],
            "二次型": ["标准形", "正定性"],
        },
        "概率论与数理统计": {
            "随机事件与概率": ["条件概率", "全概率", "贝叶斯"],
            "随机变量": ["分布函数", "密度函数", "常见分布"],
            "多维随机变量": ["联合分布", "边缘分布", "条件分布"],
            "数字特征": ["期望", "方差", "协方差", "相关系数"],
            "大数定律与中心极限定理": ["切比雪夫", "林德伯格"],
            "数理统计": ["抽样分布", "参数估计", "假设检验"],
        },
    },
    "英语": {
        "阅读理解": ["主旨题", "细节题", "推断题", "词义题", "态度题"],
        "完形填空": ["逻辑关系", "词义辨析", "固定搭配"],
        "翻译": ["英译汉", "长难句分析"],
        "写作": ["小作文", "大作文", "模板", "高级表达"],
        "词汇": ["核心词汇", "熟词僻义", "词根词缀"],
    },
    "政治": {
        "马克思主义基本原理": ["唯物论", "辩证法", "认识论", "唯物史观", "资本主义", "社会主义"],
        "毛泽东思想和中国特色社会主义": ["新民主主义", "社会主义改造", "邓小平理论", "三个代表", "科学发展观", "习近平新时代"],
        "中国近现代史纲要": ["旧民主主义", "新民主主义", "社会主义建设", "改革开放"],
        "思想道德与法治": ["人生观", "理想信念", "中国精神", "社会主义核心价值观", "法治"],
    },
}


async def get_mastery(user_id: int, session: AsyncSession) -> dict:
    stmt = (
        select(
            QuizQuestion.topic,
            func.count(QuizRecord.id).label("total"),
            func.sum(case((QuizRecord.is_correct == True, 1), else_=0)).label("correct"),
        )
        .join(QuizQuestion, QuizRecord.question_id == QuizQuestion.id)
        .where(QuizRecord.user_id == user_id)
        .group_by(QuizQuestion.topic)
    )
    result = await session.execute(stmt)
    rows = result.all()

    mastery = {}
    for row in rows:
        topic = row.topic or "未分类"
        total = row.total or 0
        correct = int(row.correct or 0)
        accuracy = round((correct / total) * 100, 1) if total > 0 else 0
        mastery[topic] = {"total": total, "correct": correct, "accuracy": accuracy}

    organized = {}
    for subject, tree in KNOWLEDGE_TREE.items():
        organized[subject] = {}
        for category, chapters in tree.items():
            if isinstance(chapters, dict):
                for chapter, topics in chapters.items():
                    if chapter in mastery:
                        organized[subject][chapter] = mastery[chapter]
                    else:
                        for t in topics:
                            if t in mastery:
                                existing = organized[subject].get(chapter, {"total": 0, "correct": 0, "accuracy": 0})
                                existing = dict(existing)
                                existing["total"] += mastery[t]["total"]
                                existing["correct"] += mastery[t]["correct"]
                                existing["accuracy"] = round((existing["correct"] / existing["total"]) * 100, 1) if existing["total"] > 0 else 0
                                organized[subject][chapter] = existing
                                break

    unmatched = {k: v for k, v in mastery.items() if k != "未分类" and not any(
        k in organized.get(s, {}) for s in organized
    )}
    if unmatched:
        organized["其他"] = unmatched

    return organized
