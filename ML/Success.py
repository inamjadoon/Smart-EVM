import pandas as pd
import random
import os

file_name = "success_dataset.csv"

# =========================
# DATASET CREATE
# =========================
if not os.path.exists(file_name):
    print("Creating dataset...")

    data = []

    for i in range(3000):

        stakeholder_satisfaction = random.randint(1, 10)
        team_experience = random.randint(1, 10)
        requirement_changes = random.randint(0, 20)
        communication = random.randint(1, 10)
        risk_management = random.randint(1, 10)
        testing = random.randint(30, 100)

        # score logic
        score = (
            stakeholder_satisfaction * 5 +
            team_experience * 4 +
            communication * 5 +
            risk_management * 4 +
            testing * 0.5 -
            requirement_changes * 3
        )

        if score > 80:
            status = "Success"
        else:
            status = "Fail"

        data.append([
            stakeholder_satisfaction,
            team_experience,
            requirement_changes,
            communication,
            risk_management,
            testing,
            status
        ])

    df = pd.DataFrame(data, columns=[
        "stakeholder_satisfaction",
        "team_experience",
        "requirement_changes",
        "communication",
        "risk_management",
        "testing",
        "status"
    ])

    df.to_csv(file_name, index=False)

else:
    print("Using existing dataset...")

# =========================
# MODEL TRAINING
# =========================
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier

data = pd.read_csv(file_name)

X = data[[
    'stakeholder_satisfaction',
    'team_experience',
    'requirement_changes',
    'communication',
    'risk_management',
    'testing'
]]

y = data['status']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

model = RandomForestClassifier(n_estimators=200)
model.fit(X_train, y_train)

# =========================
# USER INPUT
# =========================
print("\nEnter Project Details:")

stakeholder_satisfaction = float(input("Stakeholder satisfaction (1-10): "))
team_experience = float(input("Team experience (years): "))
requirement_changes = float(input("Requirement changes: "))
communication = float(input("Communication score (1-10): "))
risk_management = float(input("Risk management score (1-10): "))
testing = float(input("Testing coverage (%): "))

pred = model.predict([[
    stakeholder_satisfaction,
    team_experience,
    requirement_changes,
    communication,
    risk_management,
    testing
]])

print("\nProject Result:", pred[0])

# =========================
# REASONS
# =========================
print("\nAnalysis:")

print("\nAnalysis:")

if pred[0] == "Success":
    print("🎉 Project likely to succeed")

    print("\n✔ Success Factors:")

    if stakeholder_satisfaction >= 7:
        print("- High stakeholder satisfaction")

    if team_experience >= 7:
        print("- Strong team experience")

    if communication >= 7:
        print("- Good communication between team")

    if testing >= 70:
        print("- Strong testing coverage")

    if requirement_changes <= 5:
        print("- Stable requirements (low changes)")

else:
    print("❌ Project likely to fail")

    print("\n⚠ Failure Reasons:")

    if requirement_changes > 10:
        print("- Too many requirement changes")

    if communication < 5:
        print("- Poor communication")

    if testing < 50:
        print("- Low testing coverage")

    if stakeholder_satisfaction < 5:
        print("- Low stakeholder satisfaction")

    if team_experience < 5:
        print("- Weak team experience")

# =========================
# GRAPH
# =========================
import matplotlib.pyplot as plt

factors = ['Stakeholder', 'Experience', 'Communication', 'Testing']
values = [
    stakeholder_satisfaction,
    team_experience,
    communication,
    testing/10
]

plt.bar(factors, values)
plt.title("Success Factors")
plt.show()