import pandas as pd
import random
import os
import numpy as np
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

file_name = "cpi_spi_dataset.csv"



if not os.path.exists(file_name):
    print(" Creating dataset...")

    data = []

    for i in range(2000):

        PV = random.randint(10000, 100000)
        EV = random.randint(8000, PV)
        AC = random.randint(9000, 120000)
        time = random.randint(1, 12)

        CPI = EV / AC
        SPI = EV / PV

        if CPI >= 1 and SPI >= 1:
            status = "Healthy"
        elif CPI >= 0.8 and SPI >= 0.8:
            status = "At Risk"
        else:
            status = "Critical"

        data.append([PV, EV, AC, time, CPI, SPI, status])

    df = pd.DataFrame(data, columns=[
        "PV", "EV", "AC", "time", "CPI", "SPI", "status"
    ])

    df.to_csv(file_name, index=False)
    print("Dataset created successfully!")

else:
    print(" Using existing dataset...")


#load data
data = pd.read_csv(file_name)

X = data[["PV", "EV", "AC", "time", "CPI", "SPI"]]
y = data["status"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = RandomForestClassifier(n_estimators=200, random_state=42)
model.fit(X_train, y_train)

# ACCURACY

y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print("\n MODEL ACCURACY:", round(accuracy, 3))


# STEP 4: USER INPUT

print("\n ENTER PROJECT DETAILS")

PV = float(input("PV (Planned Value): "))
EV = float(input("EV (Earned Value): "))
AC = float(input("AC (Actual Cost): "))
time = float(input("Time (months): "))

CPI = EV / AC
SPI = EV / PV

print("\n METRICS")
print("CPI:", round(CPI, 2))
print("SPI:", round(SPI, 2))


# PREDICTION

pred = model.predict([[PV, EV, AC, time, CPI, SPI]])

print("\n PROJECT STATUS:", pred[0])


# GRAPH (IMPORTANT PART)

months = list(range(1, int(time) + 1))

pv_list = [(PV / time) * m for m in months]
ev_list = [p * random.uniform(0.8, 1.0) for p in pv_list]
ac_list = [p * random.uniform(1.0, 1.3) for p in pv_list]

plt.figure(figsize=(8,5))

plt.plot(months, pv_list, marker='o', label="PV (Planned Value)")
plt.plot(months, ev_list, marker='o', label="EV (Earned Value)")
plt.plot(months, ac_list, marker='o', label="AC (Actual Cost)")

plt.title(f"Project Performance Graph - {pred[0]}")
plt.xlabel("Time (Months)")
plt.ylabel("Cost")

plt.legend()
plt.grid(True)

plt.show()

# ANALYSIS

print("\n ANALYSIS:")

if pred[0] == "Healthy":
    print(" Project is on track")
    print("- CPI & SPI strong")
elif pred[0] == "At Risk":
    print(" Project needs monitoring")
else:
    print(" Project is failing or delayed")