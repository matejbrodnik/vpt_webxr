import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


data = pd.read_excel("FOVEATED.xlsx", sheet_name="1-5 combined")

t = []
begin = 3
j = 7
t.append(data.iloc[begin:110, j].to_numpy())
t.append(data.iloc[begin:103, j+1].to_numpy())
t.append(data.iloc[begin:67, j+2].to_numpy())
t.append(data.iloc[begin:55, j+3].to_numpy())

# print(t)

mse_ratios = []
j = 32
mse_ratios.append(data.iloc[begin:110, j].to_numpy())
mse_ratios.append(data.iloc[begin:103, j+1].to_numpy())
mse_ratios.append(data.iloc[begin:67, j+2].to_numpy())
mse_ratios.append(data.iloc[begin:55, j+3].to_numpy())


# print(mse_ratios[3])


x = t[0]
y = mse_ratios[0]

fig, ax = plt.subplots()

ax.plot(t[0], mse_ratios[0], 'c', label="0% pp")
ax.plot(t[1], mse_ratios[1], 'm', label="25% pp")
ax.plot(t[2], mse_ratios[2], "#20C020", label="50% pp")
ax.plot(t[3], mse_ratios[3], 'r', label="75% pp")

ax.grid()
# ax.set_title('1°')

ax.set_xlim(0, 500)
# ax.set_ylim(0, 2)
# ax.set_yticks(np.arange(0, 2, 1))


#ax.set(xlabel='Čas [ms]', ylabel='Razmerje usmerjeno/privzeto', fontsize=12)

ax.set_xlabel("Čas [ms]", fontsize=12)
ax.set_ylabel("Razmerje MSE (usmerjeno/privzeto)", fontsize=12)

ax.legend(
    loc="upper center",
    ncol=4,
    bbox_to_anchor=(0.5, 1.12),
    fontsize=12
)


# plt.yticks(np.arange(y.min(), y.max(), 1))
# plt.tight_layout()

plt.show()

